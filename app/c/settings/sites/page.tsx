"use client";

import { useState, type FormEvent } from "react";
import { Globe, Plus, Trash2, Loader2, CheckCircle, X, AlertCircle, Edit2, Save, Lock, Plane, CircleAlert, Info } from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { useSite, type UserSite } from "@/lib/hooks/useSite";
import { useUser } from "@/lib/hooks/useUser";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { isAdminEmail } from "@/lib/admin";
import { languageFromDomain } from "@/lib/content/language";
import {
  evaluateSiteReadiness,
  type ReadinessCheck,
  type SiteReadiness,
} from "@/lib/content/site-readiness";

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
  // Language is captured at creation rather than left to a later visit to
  // /c/settings: it drives what language every generated article is written in,
  // and a site added without it used to publish English on a Swedish domain.
  // "" means "derive it from the domain", which is right far more often than a
  // hardcoded default.
  const [newLanguage, setNewLanguage] = useState("");
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
    const domain = newDomain.trim();
    // Seed the settings a site needs to be automatable, not just identifiable.
    // The previous version wrote brand_name + domain only, so a new site had no
    // language and no autopilot block at all — it silently did nothing until
    // someone found three different settings screens. Autopilot is still
    // created disabled (enabling generation for a site nobody asked to automate
    // would fill the calendar behind the user's back); the Sites list now shows
    // exactly what is left to switch on.
    const settings: Record<string, unknown> = {
      brand_name: siteName,
      domain,
      content_language: newLanguage || languageFromDomain(domain) || "en",
      content_autopilot: {
        enabled: false,
        cadence: "weekly",
        ideas_per_run: 6,
        auto_draft_top_n: 3,
        min_score_for_publish: 70,
        auto_publish: false,
      },
    };
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
      setNewLanguage("");
      flash("Sajten är tillagd. Slå på autopilot och välj publiceringsmål nedan för att den ska köra av sig själv.");
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Innehållsspråk</label>
                <select
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">
                    Från domänen{languageFromDomain(newDomain) ? ` (${languageFromDomain(newDomain)})` : " (en)"}
                  </option>
                  <option value="sv">Svenska (sv)</option>
                  <option value="nb">Norsk (nb)</option>
                  <option value="da">Dansk (da)</option>
                  <option value="en">English (en)</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Allt som autopiloten skriver för sajten hamnar på det här språket.
                </p>
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
                onClick={() => { setShowAdd(false); setNewName(""); setNewDomain(""); setNewLanguage(""); }}
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
            const readiness = evaluateSiteReadiness(site);
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

                <AutomationReadiness readiness={readiness} />
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

/**
 * Per-site automation status.
 *
 * The crons decide site by site, so on a multi-site account one domain can be
 * fully automatic while the one next to it silently does nothing. This panel
 * answers the only question that matters when you own several: will this site
 * write and publish on its own, and if not, what is missing?
 */
function AutomationReadiness({ readiness }: { readiness: SiteReadiness }) {
  const { willGenerate, willPublish, mode } = readiness;
  const running = willGenerate && willPublish;

  const summary = running
    ? mode === "automatic"
      ? "Kör automatiskt — skriver och publicerar utan att du gör något"
      : "Kör automatiskt — utkast väntar på ditt godkännande i /c/approvals"
    : willGenerate
      ? "Skriver artiklar, men publicerar dem inte"
      : "Gör ingenting just nu";

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-2">
        <Plane className={`h-3.5 w-3.5 ${running ? "text-green-600" : "text-amber-500"}`} />
        <span className={`text-xs font-medium ${running ? "text-green-700" : "text-amber-700"}`}>
          {summary}
        </span>
      </div>

      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {readiness.checks.map((check) => (
          <ReadinessRow key={check.key} check={check} />
        ))}
      </ul>
    </div>
  );
}

function ReadinessRow({ check }: { check: ReadinessCheck }) {
  const Icon =
    check.status === "ok" ? CheckCircle : check.status === "info" ? Info : CircleAlert;
  const tone =
    check.status === "ok"
      ? "text-green-600"
      : check.status === "info"
        ? "text-slate-400"
        : "text-amber-500";

  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${tone}`} />
      <span className="min-w-0">
        <span className="font-medium text-slate-700">{check.label}:</span>{" "}
        <span className="text-slate-500">{check.detail}</span>{" "}
        {check.fixHref && check.status !== "ok" && (
          <a href={check.fixHref} className="text-blue-600 hover:text-blue-700 whitespace-nowrap">
            Åtgärda
          </a>
        )}
      </span>
    </li>
  );
}
