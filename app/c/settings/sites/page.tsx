"use client";

import { useState, type FormEvent } from "react";
import { Globe, Plus, Trash2, Loader2, CheckCircle, X, AlertCircle, Edit2, Save, Lock } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useSite, type UserSite } from "@/lib/hooks/useSite";
import { useUser } from "@/lib/hooks/useUser";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { isAdminEmail } from "@/lib/admin";

export default function SitesSettingsPage() {
  const { user } = useUser();
  const { sites, activeSite, setActiveSiteId, reloadSites, effectiveOwnerId, viewAs } = useSite();
  const isAdmin = isAdminEmail(user?.email);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Add-site form state
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim() || !newDomain.trim()) return;
    if (!isAdmin) {
      setError("Only admins can add sites. Please contact your admin.");
      return;
    }
    const ownerId = effectiveOwnerId || user.id;
    const siteName = newName.trim();
    const settings = { brand_name: siteName, domain: newDomain.trim() };
    setAdding(true);
    setError("");
    try {
      // In admin view-as mode, RLS won't allow auth.uid() (admin) to insert with
      // user_id = customer's id, so go through the admin API which bypasses RLS.
      if (viewAs) {
        const res = await fetch(`/api/admin/user-sites/${viewAs.userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site_name: siteName, settings }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } else {
        const { error: insertError } = await getSupabaseBrowser()
          .from("user_sites")
          .insert({ user_id: ownerId, site_name: siteName, settings });
        if (insertError) throw new Error(insertError.message);
      }
      await reloadSites();
      setShowAdd(false);
      setNewName("");
      setNewDomain("");
      flash("Site added!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the site");
    }
    setAdding(false);
  };

  const handleRename = async (site: UserSite) => {
    if (!user || !editName.trim()) return;
    setBusy(site.id);
    try {
      if (viewAs) {
        const res = await fetch(`/api/admin/user-sites/${viewAs.userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: site.id, site_name: editName.trim() }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } else {
        const { error: updateError } = await getSupabaseBrowser()
          .from("user_sites")
          .update({ site_name: editName.trim(), updated_at: new Date().toISOString() })
          .eq("id", site.id);
        if (updateError) throw new Error(updateError.message);
      }
      await reloadSites();
      setEditingId(null);
      flash("Name saved!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename");
    }
    setBusy(null);
  };

  const handleDelete = async (site: UserSite) => {
    if (!user) return;
    if (sites.length <= 1) {
      setError("You can't remove the last site.");
      return;
    }
    if (!confirm(`Remove "${site.site_name}"? This cannot be undone.`)) return;
    setBusy(site.id);
    setError("");
    try {
      if (viewAs) {
        const res = await fetch(
          `/api/admin/user-sites/${viewAs.userId}?id=${encodeURIComponent(site.id)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } else {
        const { error: deleteError } = await getSupabaseBrowser()
          .from("user_sites")
          .delete()
          .eq("id", site.id);
        if (deleteError) throw new Error(deleteError.message);
      }
      // Switch active if needed
      if (activeSite?.id === site.id) {
        const remaining = sites.filter((s) => s.id !== site.id);
        if (remaining.length > 0) setActiveSiteId(remaining[0].id);
      }
      await reloadSites();
      flash("Site removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the site");
    }
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Globe className="h-6 w-6 text-slate-400" />
              Sites
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage websites linked to this account. Each site has its own settings and agents.
            </p>
          </div>
          {isAdmin ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add site
            </button>
          ) : (
            <div
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"
              title="Only admins can add sites"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Contact your admin to add more sites</span>
            </div>
          )}
        </div>

        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle className="h-4 w-4" /> {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</div>
            <button onClick={() => setError("")}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Add-site form */}
        {showAdd && isAdmin && (
          <form
            onSubmit={handleAdd}
            className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-900">New site</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Site name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Acme Blog"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Domain *</label>
                <input
                  type="text"
                  required
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="blog.acme.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewName(""); setNewDomain(""); }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Sites list */}
        <div className="space-y-3">
          {sites.map((site) => {
            const isActive = site.id === activeSite?.id;
            const domain = site.settings?.domain as string | undefined;
            const isBusy = busy === site.id;
            const isEditing = editingId === site.id;
            return (
              <div
                key={site.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-colors ${
                  isActive ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 rounded-lg p-2 flex-shrink-0 ${isActive ? "bg-blue-50" : "bg-slate-100"}`}>
                      <Globe className={`h-4 w-4 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
                    </div>
                    <div className="min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="rounded-lg border border-blue-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleRename(site)}
                            disabled={isBusy}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{site.site_name || "Unnamed site"}</span>
                          {isActive && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              Active
                            </span>
                          )}
                        </div>
                      )}
                      {domain && !isEditing && (
                        <p className="text-xs text-slate-400 mt-0.5">{domain}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => setActiveSiteId(site.id)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Select
                      </button>
                    )}
                    {!isEditing && (
                      <button
                        onClick={() => { setEditingId(site.id); setEditName(site.site_name); }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                        title="Rename"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(site)}
                      disabled={isBusy || sites.length <= 1}
                      title={sites.length <= 1 ? "Cannot remove the last site" : "Remove site"}
                      className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-slate-400">
          Each site has its own settings, competitors and agents. Pick a site via the dropdown in the navigation to see its data.
        </p>
      </main>
    </div>
  );
}
