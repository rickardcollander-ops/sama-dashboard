"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, UserPlus, Loader2, AlertCircle, CheckCircle2, X, Mail,
  Shield, Trash2, Crown, Clock,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useUser } from "@/lib/hooks/useUser";
import { useSite } from "@/lib/hooks/useSite";

interface Member {
  id: string;
  account_id: string;
  user_id: string | null;
  invited_email: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
  status: "pending" | "active";
  created_at: string;
  accepted_at: string | null;
  last_sign_in_at: string | null;
}

const ROLE_LABEL: Record<Member["role"], string> = {
  owner: "Ägare",
  admin: "Administratör",
  member: "Medlem",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function TeamSettingsPage() {
  const { user, loading: userLoading } = useUser();
  const { activeAccountId, myRole, accounts } = useSite();
  const [members, setMembers] = useState<Member[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviting, setInviting] = useState(false);

  const canManage = myRole === "owner" || myRole === "admin";
  const activeAccount = accounts.find((a) => a.account_id === activeAccountId);
  const accountLabel =
    activeAccount?.brand_name ||
    activeAccount?.domain ||
    activeAccount?.owner_email ||
    "kontot";

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  const headers = useCallback((): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    if (activeAccountId) h["x-sama-account-id"] = activeAccountId;
    return h;
  }, [activeAccountId]);

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setFetching(true);
    setError("");
    try {
      const res = await fetch("/api/account/members", {
        headers: headers(),
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { members: Member[] };
      setMembers(body.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte hämta medlemmar");
    } finally {
      setFetching(false);
    }
  }, [activeAccountId, headers]);

  useEffect(() => {
    if (userLoading) return;
    void load();
  }, [load, userLoading]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setError("");
    try {
      const res = await fetch("/api/account/members", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      flash(
        body.invited
          ? `Inbjudan skickad till ${email}`
          : `${email} har lagts till — kunde logga in direkt`,
      );
      setInviteEmail("");
      setInviteRole("member");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte bjuda in");
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (m: Member, role: "admin" | "member") => {
    setPendingId(m.id);
    setError("");
    try {
      const res = await fetch(`/api/account/members/${m.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ role }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
      flash(`Roll uppdaterad`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte uppdatera rollen");
    } finally {
      setPendingId(null);
    }
  };

  const handleRemove = async (m: Member) => {
    const label = m.email || m.invited_email || "denna medlem";
    if (!confirm(`Ta bort ${label} från kontot?`)) return;
    setPendingId(m.id);
    setError("");
    try {
      const res = await fetch(`/api/account/members/${m.id}`, {
        method: "DELETE",
        headers: headers(),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      flash(`${label} borttagen`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte ta bort medlemmen");
    } finally {
      setPendingId(null);
    }
  };

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CustomerNav />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Hämtar…
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-slate-900">
            <Users className="h-7 w-7 text-blue-600" />
            Team
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hantera vilka som har tillgång till {accountLabel}.
          </p>
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

        {/* Invite form */}
        {canManage ? (
          <form
            onSubmit={handleInvite}
            className="mb-6 rounded-xl border bg-white p-5 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserPlus className="h-4 w-4 text-slate-400" /> Bjud in en medlem
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  E-post
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="kollega@foretag.se"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="sm:w-44">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Roll
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="member">Medlem</option>
                  <option value="admin">Administratör</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {inviting ? "Skickar…" : "Bjud in"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Administratörer kan bjuda in fler medlemmar och hantera teamet. Medlemmar får full
              tillgång till data men kan inte ändra teamet.
            </p>
          </form>
        ) : (
          <div className="mb-6 rounded-xl border bg-amber-50 p-4 text-sm text-amber-800">
            Endast administratörer kan bjuda in nya medlemmar. Be ägaren att uppgradera din roll om
            du behöver det.
          </div>
        )}

        {/* Members table */}
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Medlem</th>
                <th className="px-4 py-3">Roll</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tillagd</th>
                {canManage && <th className="px-4 py-3 text-right">Åtgärder</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetching && members.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}
              {!fetching && members.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
                    Inga medlemmar än.
                  </td>
                </tr>
              )}
              {members.map((m) => {
                const isSelf = m.user_id === user.id;
                const isOwner = m.role === "owner";
                const busy = pendingId === m.id;
                return (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 flex items-center gap-2">
                        {m.email || m.invited_email || "(okänd)"}
                        {isSelf && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            du
                          </span>
                        )}
                      </div>
                      {m.last_sign_in_at && (
                        <div className="text-xs text-slate-400">
                          Senast inloggad {fmtDate(m.last_sign_in_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
                        {isOwner ? (
                          <Crown className="h-3.5 w-3.5 text-amber-500" />
                        ) : m.role === "admin" ? (
                          <Shield className="h-3.5 w-3.5 text-blue-500" />
                        ) : null}
                        {ROLE_LABEL[m.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.status === "active" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Aktiv
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <Clock className="h-3 w-3" /> Inbjuden
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmtDate(m.created_at)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!isOwner && (
                            <select
                              value={m.role}
                              onChange={(e) =>
                                void handleRoleChange(m, e.target.value as "admin" | "member")
                              }
                              disabled={busy || isSelf}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                            >
                              <option value="member">Medlem</option>
                              <option value="admin">Administratör</option>
                            </select>
                          )}
                          {!isOwner && !isSelf && (
                            <button
                              onClick={() => void handleRemove(m)}
                              disabled={busy}
                              title="Ta bort medlem"
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                              Ta bort
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
