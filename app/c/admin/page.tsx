"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  Trash2,
  Mail,
  RefreshCw,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { isAdminEmail } from "@/lib/admin";

interface Account {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  brand_name: string | null;
  domain: string | null;
  has_settings: boolean;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "never";
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

export default function AdminPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const isAdmin = isAdminEmail(user?.email);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await fetch("/api/admin/accounts", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { accounts: Account[] };
      setAccounts(body.accounts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/c/login");
      return;
    }
    if (!isAdmin) {
      router.push("/c/dashboard");
      return;
    }
    void load();
  }, [user, loading, isAdmin, router, load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setNotice(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleDelete = async (acc: Account) => {
    if (!confirm(`Delete account ${acc.email ?? acc.id}? This cannot be undone.`)) return;
    setPendingId(acc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setNotice(`Deleted ${acc.email ?? acc.id}`);
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account");
    } finally {
      setPendingId(null);
    }
  };

  const handleResetPassword = async (acc: Account) => {
    setPendingId(acc.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/accounts/${acc.id}/reset-password`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setNotice(`Password reset email sent to ${acc.email ?? acc.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send reset email");
    } finally {
      setPendingId(null);
    }
  };

  const filtered = accounts.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (a.email ?? "").toLowerCase().includes(q) ||
      (a.brand_name ?? "").toLowerCase().includes(q) ||
      (a.domain ?? "").toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
    );
  });

  const confirmedCount = accounts.filter((a) => a.email_confirmed_at).length;
  const onboardedCount = accounts.filter((a) => a.has_settings).length;

  if (loading || (!user && !loading)) {
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-6xl px-6 py-12">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            <div className="flex items-center gap-2 font-semibold">
              <Shield className="h-5 w-5" /> Forbidden
            </div>
            <p className="mt-2 text-sm">Only the admin can access this page.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
              <Shield className="h-7 w-7 text-blue-600" />
              Admin
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage SAMA accounts. Signed in as {user?.email}.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={fetching}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
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

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Total accounts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{accounts.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Email confirmed</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{confirmedCount}</p>
          </div>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">Completed onboarding</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{onboardedCount}</p>
          </div>
        </div>

        {/* Invite */}
        <form
          onSubmit={handleInvite}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5 shadow-sm"
        >
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Invite a new user
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {inviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Send invite
          </button>
        </form>

        {/* Search */}
        <div className="mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, brand or domain…"
            className="w-full sm:w-80 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetching && accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!fetching && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No accounts match your search.
                  </td>
                </tr>
              )}
              {filtered.map((acc) => {
                const isSelf = acc.email && isAdminEmail(acc.email);
                const busy = pendingId === acc.id;
                return (
                  <tr key={acc.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {acc.email ?? "(no email)"}
                        {isSelf && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            <Shield className="h-3 w-3" /> admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{acc.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      {acc.brand_name ? (
                        <div>
                          <div className="font-medium text-slate-900">{acc.brand_name}</div>
                          {acc.domain && (
                            <div className="text-xs text-slate-400">{acc.domain}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">No onboarding</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{fmtDate(acc.created_at)}</div>
                      <div className="text-xs text-slate-400">{fmtRelative(acc.created_at)}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{fmtDate(acc.last_sign_in_at)}</div>
                      <div className="text-xs text-slate-400">
                        {fmtRelative(acc.last_sign_in_at)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {acc.email_confirmed_at ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => void handleResetPassword(acc)}
                          disabled={busy || !acc.email}
                          title="Send password reset email"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Mail className="h-3 w-3" />
                          )}
                          Reset
                        </button>
                        <button
                          onClick={() => void handleDelete(acc)}
                          disabled={busy || isSelf}
                          title={
                            isSelf
                              ? "Cannot delete your own admin account"
                              : "Delete account"
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-slate-400">
          Account data comes from Supabase Auth and the user_settings table.
          Deletes use the Supabase admin API and remove the auth user plus
          their linked rows via ON DELETE CASCADE.
        </p>
      </main>
    </div>
  );
}
