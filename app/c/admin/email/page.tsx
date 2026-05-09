"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield, Mail, RefreshCw, AlertCircle, CheckCircle2, Loader2, X,
  Send, ArrowLeft, ChevronRight, Power, Save, Calendar,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { isAdminEmail } from "@/lib/admin";

// ── Types ─────────────────────────────────────────────────────────────────────────

interface LogRow {
  id: string;
  user_id: string | null;
  recipient: string;
  kind: string;
  subject: string;
  status: string;
  message_id: string | null;
  error: string | null;
  stats: Record<string, unknown> | null;
  test: boolean;
  created_at: string;
}

interface ScheduleRow {
  kind: string;
  enabled: boolean;
  cron_day_of_week: string | null;
  cron_hour: number | null;
  cron_minute: number;
  timezone: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

interface UserRow {
  user_id: string;
  email: string | null;
  brand_name: string | null;
  weekly_email_enabled: boolean;
  recipient_override: string | null;
  last_sent_at: { weekly_status?: string; social_posts?: string };
}

const KIND_LABELS: Record<string, string> = {
  weekly_status: "Veckostatus",
  social_posts: "Sociala posts",
};

const DAY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Varje dag" },
  { value: "mon", label: "Måndag" },
  { value: "tue", label: "Tisdag" },
  { value: "wed", label: "Onsdag" },
  { value: "thu", label: "Torsdag" },
  { value: "fri", label: "Fredag" },
  { value: "sat", label: "Lördag" },
  { value: "sun", label: "Söndag" },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("sv-SE");
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "Aldrig";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just nu";
  if (mins < 60) return `${mins} min sedan`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h sedan`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d sedan`;
  return new Date(iso).toLocaleDateString("sv-SE");
}

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

// ── Page ──────────────────────────────────────────────────────────────────────────

type TabId = "log" | "schedules" | "users";

export default function AdminEmailPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const isAdmin = isAdminEmail(user?.email);

  const [tab, setTab] = useState<TabId>("log");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/c/login"); return; }
    if (!isAdmin) { router.push("/c/dashboard"); return; }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  if (loading || (!user && !loading)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Laddar…
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="h-5 w-5" /> Forbidden
            </div>
            <p className="mt-2 text-sm">Endast admin har åtkomst till sidan.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/c/admin"
              className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Tillbaka till Admin
            </Link>
            <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
              <Mail className="h-7 w-7 text-blue-600" />
              Mejl
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Logg, schema och per-kund-inställningar för veckomail och sociala posts-mail.
            </p>
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
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {notice}
          </div>
        )}

        <div className="mb-6 flex gap-1 border-b border-slate-200">
          {([
            ["log", "Logg"],
            ["schedules", "Schema"],
            ["users", "Användare"],
          ] as [TabId, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "log" && <LogTab onError={setError} />}
        {tab === "schedules" && (
          <SchedulesTab onError={setError} onNotice={setNotice} />
        )}
        {tab === "users" && <UsersTab onError={setError} onNotice={setNotice} />}
      </main>
    </div>
  );
}

// ── Log tab ────────────────────────────────────────────────────────────────────────
function LogTab({ onError }: { onError: (msg: string) => void }) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [recipient, setRecipient] = useState("");
  const [includeTest, setIncludeTest] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (kind) qs.set("kind", kind);
      if (status) qs.set("status", status);
      if (recipient.trim()) qs.set("recipient", recipient.trim());
      if (!includeTest) qs.set("include_test", "0");
      qs.set("limit", "100");
      const res = await fetch(`/api/admin/email/log?${qs}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { rows: LogRow[]; total: number };
      setRows(body.rows);
      setTotal(body.total);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte ladda loggen");
    } finally {
      setLoading(false);
    }
  }, [kind, status, recipient, includeTest, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Typ</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Alla</option>
            <option value="weekly_status">Veckostatus</option>
            <option value="social_posts">Sociala posts</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Alla</option>
            <option value="sent">Skickade</option>
            <option value="error">Fel</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Mottagare</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="sok@exempel.se"
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 mb-1">
          <input
            type="checkbox"
            checked={includeTest}
            onChange={(e) => setIncludeTest(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 accent-blue-600"
          />
          Inkludera test-sand
        </label>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Uppdatera
        </button>
      </div>

      <p className="mb-2 text-xs text-slate-500">
        {total.toLocaleString("sv-SE")} rader matchar (visar upp till 100).
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Tid</th>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2">Mottagare</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ämne</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">Inga rader matchar filtret.</td></tr>
            )}
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              return (
                <FragmentRow
                  key={row.id}
                  row={row}
                  isOpen={isOpen}
                  onToggle={() => setExpanded(isOpen ? null : row.id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FragmentRow({
  row,
  isOpen,
  onToggle,
}: {
  row: LogRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="hover:bg-slate-50/60 cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
          <div>{fmtDate(row.created_at)}</div>
          <div className="text-xs text-slate-400">{fmtRelative(row.created_at)}</div>
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {kindLabel(row.kind)}
          </span>
          {row.test && (
            <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              TEST
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-slate-700">{row.recipient}</td>
        <td className="px-3 py-2">
          {row.status === "sent" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Skickat
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-3 w-3" /> Fel
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-slate-700 max-w-[280px] truncate">{row.subject}</td>
        <td className="px-3 py-2 text-slate-400">
          <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-slate-50/60">
          <td colSpan={6} className="px-3 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-semibold text-slate-600 mb-1">User ID</div>
                <div className="font-mono text-slate-700 break-all">{row.user_id ?? "—"}</div>
              </div>
              <div>
                <div className="font-semibold text-slate-600 mb-1">Provider message id</div>
                <div className="font-mono text-slate-700 break-all">{row.message_id ?? "—"}</div>
              </div>
              <div className="md:col-span-2">
                <div className="font-semibold text-slate-600 mb-1">Stats</div>
                <pre className="whitespace-pre-wrap rounded bg-white border border-slate-200 p-2 text-slate-700">
                  {JSON.stringify(row.stats ?? {}, null, 2)}
                </pre>
              </div>
              {row.error && (
                <div className="md:col-span-2">
                  <div className="font-semibold text-red-700 mb-1">Fel</div>
                  <pre className="whitespace-pre-wrap rounded bg-red-50 border border-red-200 p-2 text-red-800">
                    {row.error}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Schedules tab ────────────────────────────────────────────────────────────────────
function SchedulesTab({
  onError,
  onNotice,
}: {
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
}) {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKind, setSavingKind] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email/schedules", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { schedules: ScheduleRow[] };
      setSchedules(body.schedules);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte ladda schema");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateLocal = (kind: string, patch: Partial<ScheduleRow>) => {
    setSchedules((prev) => prev.map((s) => (s.kind === kind ? { ...s, ...patch } : s)));
  };

  const save = async (s: ScheduleRow) => {
    setSavingKind(s.kind);
    try {
      const res = await fetch("/api/admin/email/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: s.kind,
          enabled: s.enabled,
          cron_day_of_week: s.cron_day_of_week || null,
          cron_hour: s.cron_hour,
          cron_minute: s.cron_minute,
          timezone: s.timezone || "UTC",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { schedule: ScheduleRow };
      updateLocal(s.kind, body.schedule);
      onNotice(`Schema sparat för ${kindLabel(s.kind)}. Schemaservern laddar om inom 60 sekunder.`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte spara schema");
    } finally {
      setSavingKind(null);
    }
  };

  if (loading && schedules.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center text-slate-500 shadow-sm">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {schedules.map((s) => {
        const busy = savingKind === s.kind;
        return (
          <div key={s.kind} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <h3 className="text-base font-semibold text-slate-900">{kindLabel(s.kind)}</h3>
                </div>
                {s.description && (
                  <p className="mt-1 text-xs text-slate-500">{s.description}</p>
                )}
              </div>
              <button
                onClick={() => updateLocal(s.kind, { enabled: !s.enabled })}
                title={s.enabled ? "Klicka för att stänga av" : "Klicka för att aktivera"}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  s.enabled
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <Power className="h-3 w-3" />
                {s.enabled ? "Aktiv" : "Av"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Veckodag</label>
                <select
                  value={s.cron_day_of_week ?? ""}
                  onChange={(e) => updateLocal(s.kind, { cron_day_of_week: e.target.value || null })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {DAY_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Timme</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={s.cron_hour ?? ""}
                  placeholder="varje"
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0));
                    updateLocal(s.kind, { cron_hour: v });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-0.5 text-[10px] text-slate-400">tom = varje timme</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Minut</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={s.cron_minute}
                  onChange={(e) => updateLocal(s.kind, { cron_minute: Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)) })}
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <div>
                Tidszon <span className="font-mono">{s.timezone}</span>
                {s.updated_at && (
                  <> · senast ändrad {fmtRelative(s.updated_at)}{s.updated_by ? ` av ${s.updated_by}` : ""}</>
                )}
              </div>
              <button
                onClick={() => void save(s)}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {busy ? "Sparar…" : "Spara"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Users tab ──────────────────────────────────────────────────────────────────────
function UsersTab({
  onError,
  onNotice,
}: {
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email/users", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { users: UserRow[] };
      setUsers(body.users);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte ladda användare");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.brand_name ?? "").toLowerCase().includes(q) ||
        (u.recipient_override ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const toggleWeekly = async (u: UserRow, value: boolean) => {
    setPendingId(u.user_id);
    try {
      const res = await fetch(`/api/admin/email/users/${u.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekly_email_enabled: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setUsers((prev) =>
        prev.map((row) => (row.user_id === u.user_id ? { ...row, weekly_email_enabled: value } : row)),
      );
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte uppdatera");
    } finally {
      setPendingId(null);
    }
  };

  const saveOverride = async (u: UserRow, override: string) => {
    setPendingId(u.user_id);
    try {
      const res = await fetch(`/api/admin/email/users/${u.user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient_override: override.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { recipient_override: string | null };
      setUsers((prev) =>
        prev.map((row) => (row.user_id === u.user_id ? { ...row, recipient_override: body.recipient_override } : row)),
      );
      onNotice(`Mottagar-override sparad för ${u.email ?? u.user_id}`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte spara mottagare");
    } finally {
      setPendingId(null);
    }
  };

  const sendNow = async (u: UserRow) => {
    if (!confirm(`Skicka [TEST]-veckomail till ${u.recipient_override ?? u.email ?? u.user_id}?`)) return;
    setPendingId(u.user_id);
    try {
      const res = await fetch(`/api/admin/email/users/${u.user_id}/send-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.skipped) {
        onNotice(`Höll inne sand: ${body.reason}`);
      } else {
        onNotice(`Skickat till ${body.recipient ?? u.email ?? u.user_id}`);
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte skicka");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sok på e-post, varumärke eller override…"
          className="w-full sm:w-80 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Uppdatera
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Användare</th>
              <th className="px-3 py-2">Veckomail</th>
              <th className="px-3 py-2">Mottagar-override</th>
              <th className="px-3 py-2">Senast skickat</th>
              <th className="px-3 py-2 text-right">Åtgärder</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && users.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Inga användare matchar.</td></tr>
            )}
            {filtered.map((u) => {
              const busy = pendingId === u.user_id;
              return (
                <UserRowComp
                  key={u.user_id}
                  u={u}
                  busy={busy}
                  onToggle={(v) => toggleWeekly(u, v)}
                  onSaveOverride={(v) => saveOverride(u, v)}
                  onSendNow={() => sendNow(u)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function UserRowComp({
  u,
  busy,
  onToggle,
  onSaveOverride,
  onSendNow,
}: {
  u: UserRow;
  busy: boolean;
  onToggle: (v: boolean) => void;
  onSaveOverride: (v: string) => void;
  onSendNow: () => void;
}) {
  const [override, setOverride] = useState(u.recipient_override ?? "");
  useEffect(() => {
    setOverride(u.recipient_override ?? "");
  }, [u.recipient_override]);

  const dirty = (override.trim() || null) !== (u.recipient_override ?? null);

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-2">
        <div className="font-medium text-slate-900">{u.email ?? "(ingen e-post)"}</div>
        {u.brand_name && (
          <div className="text-xs text-slate-500">{u.brand_name}</div>
        )}
        <div className="text-[10px] text-slate-400 font-mono">{u.user_id}</div>
      </td>
      <td className="px-3 py-2">
        <button
          onClick={() => onToggle(!u.weekly_email_enabled)}
          disabled={busy}
          className={`inline-flex h-5 w-9 items-center rounded-full transition ${
            u.weekly_email_enabled ? "bg-emerald-500" : "bg-slate-300"
          } disabled:opacity-50`}
          aria-label="Slå på/av veckomail"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
              u.weekly_email_enabled ? "translate-x-4" : "translate-x-1"
            }`}
          />
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="email"
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder={u.email ?? "override@exempel.se"}
            className="w-full max-w-[220px] rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          />
          {dirty && (
            <button
              onClick={() => onSaveOverride(override)}
              disabled={busy}
              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </button>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">
        <div>Vecko: {fmtRelative(u.last_sent_at?.weekly_status)}</div>
        <div className="text-slate-400">Sociala: {fmtRelative(u.last_sent_at?.social_posts)}</div>
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={onSendNow}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Skicka nu
        </button>
      </td>
    </tr>
  );
}
