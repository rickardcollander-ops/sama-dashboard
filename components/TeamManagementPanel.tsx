"use client";

import { useCallback, useEffect, useState } from "react";
import {
  UserPlus, Loader2, AlertCircle, CheckCircle2, X, Mail,
  Trash2, Crown, Clock,
} from "lucide-react";
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

// Admin-created accounts that don't have a real email use a placeholder of
// the form ``<domain>-<timestamp>@accounts.internal``. Hide the placeholder
// from the team panel and show a friendlier label instead.
function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith("@accounts.internal");
}

function displayMemberLabel(m: { email: string | null; invited_email: string | null }): string {
  const raw = m.email || m.invited_email;
  if (!raw) return "(no email)";
  if (isPlaceholderEmail(raw)) return "Account owner (no email yet)";
  return raw;
}

interface TeamManagementPanelProps {
  /** Render in compact mode (inside another section card) — drops the outer header. */
  compact?: boolean;
}

export default function TeamManagementPanel({ compact = false }: TeamManagementPanelProps) {
  const { user, loading: userLoading } = useUser();
  const { activeAccountId } = useSite();
  const [members, setMembers] = useState<Member[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

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
      setError(e instanceof Error ? e.message : "Could not fetch members");
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
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      flash(
        body.invited
          ? `Invitation sent to ${email}`
          : `${email} has been added — they can sign in right away`,
      );
      setInviteEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (m: Member) => {
    const label = m.email || m.invited_email || "this member";
    if (!confirm(`Remove ${label} from the account?`)) return;
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
      flash(`${label} removed`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the member");
    } finally {
      setPendingId(null);
    }
  };

  if (userLoading || !user) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> {notice}
        </div>
      )}

      <form
        onSubmit={handleInvite}
        className={
          compact
            ? "rounded-lg border border-slate-200 bg-slate-50 p-3"
            : "rounded-xl border bg-white p-5 shadow-sm"
        }
      >
        {!compact && (
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserPlus className="h-4 w-4 text-slate-400" /> Invite a member
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {inviting ? "Sending…" : "Invite"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          All members have full access to the account — they can see data, change settings and invite more.
        </p>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Added</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fetching && members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            )}
            {!fetching && members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                  No members yet.
                </td>
              </tr>
            )}
            {members.map((m) => {
              const isSelf = m.user_id === user.id;
              const isOwner = m.role === "owner";
              const busy = pendingId === m.id;
              return (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      {isOwner && (
                        <Crown className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                      )}
                      <span className={isPlaceholderEmail(m.email || m.invited_email) ? "italic text-slate-500" : ""}>
                        {displayMemberLabel(m)}
                      </span>
                      {isSelf && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          you
                        </span>
                      )}
                      {isOwner && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          owner
                        </span>
                      )}
                    </div>
                    {m.last_sign_in_at && (
                      <div className="text-xs text-slate-400">
                        Last sign-in {fmtDate(m.last_sign_in_at)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {m.status === "active" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <Clock className="h-3 w-3" /> Invited
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{fmtDate(m.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
