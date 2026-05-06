"use client";

import { useState, type FormEvent } from "react";
import { Globe, Plus, Trash2, Loader2, CheckCircle, X, AlertCircle, Edit2, Save } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useSite, type UserSite } from "@/lib/hooks/useSite";
import { useUser } from "@/lib/hooks/useUser";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function SitesSettingsPage() {
  const { user } = useUser();
  const { sites, activeSite, setActiveSiteId, reloadSites } = useSite();
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
    setAdding(true);
    setError("");
    try {
      const { error: insertError } = await getSupabaseBrowser()
        .from("user_sites")
        .insert({
          user_id: user.id,
          site_name: newName.trim(),
          settings: { brand_name: newName.trim(), domain: newDomain.trim() },
        });
      if (insertError) throw new Error(insertError.message);
      await reloadSites();
      setShowAdd(false);
      setNewName("");
      setNewDomain("");
      flash("Sidan är tillagd!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte lägga till sidan");
    }
    setAdding(false);
  };

  const handleRename = async (site: UserSite) => {
    if (!user || !editName.trim()) return;
    setBusy(site.id);
    try {
      const { error: updateError } = await getSupabaseBrowser()
        .from("user_sites")
        .update({ site_name: editName.trim(), updated_at: new Date().toISOString() })
        .eq("id", site.id);
      if (updateError) throw new Error(updateError.message);
      await reloadSites();
      setEditingId(null);
      flash("Namn sparat!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte byta namn");
    }
    setBusy(null);
  };

  const handleDelete = async (site: UserSite) => {
    if (!user) return;
    if (sites.length <= 1) {
      setError("Du kan inte ta bort den sista sidan.");
      return;
    }
    if (!confirm(`Ta bort "${site.site_name}"? Det går inte att ångra.`)) return;
    setBusy(site.id);
    setError("");
    try {
      const { error: deleteError } = await getSupabaseBrowser()
        .from("user_sites")
        .delete()
        .eq("id", site.id);
      if (deleteError) throw new Error(deleteError.message);
      // Switch active if needed
      if (activeSite?.id === site.id) {
        const remaining = sites.filter((s) => s.id !== site.id);
        if (remaining.length > 0) setActiveSiteId(remaining[0].id);
      }
      await reloadSites();
      flash("Sidan är borttagen.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ta bort sidan");
    }
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Globe className="h-6 w-6 text-slate-400" />
              Sidor
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Hantera webbsidor kopplade till det här kontot. Varje sida har egna inställningar och agenter.
            </p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Lägg till sida
          </button>
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
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold text-slate-900">Ny sida</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sidnamn *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Acme Blogg"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Domän *</label>
                <input
                  type="text"
                  required
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="blogg.acme.se"
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
                Skapa
              </button>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewName(""); setNewDomain(""); }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Avbryt
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
                            Spara
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
                          <span className="font-medium text-slate-900">{site.site_name || "Namnlös sida"}</span>
                          {isActive && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              Aktiv
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
                        Välj
                      </button>
                    )}
                    {!isEditing && (
                      <button
                        onClick={() => { setEditingId(site.id); setEditName(site.site_name); }}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                        title="Byt namn"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(site)}
                      disabled={isBusy || sites.length <= 1}
                      title={sites.length <= 1 ? "Kan inte ta bort den sista sidan" : "Ta bort sida"}
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
          Varje sida har egna inställningar, konkurrenter och agenter. Välj en sida via dropdownen i navigationen för att se dess data.
        </p>
      </main>
    </div>
  );
}
