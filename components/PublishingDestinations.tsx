"use client";

import { useEffect, useState } from "react";
import {
  Plus, Trash2, Loader2, CheckCircle, AlertCircle, Save, X, Send, Globe,
} from "lucide-react";
import { CmsKind } from "@/lib/integrations/cms/types";
import { KIND_META, SUPPORTED_KINDS } from "@/lib/integrations/cms";
import { useSite } from "@/lib/hooks/useSite";

interface Destination {
  id: string;
  kind: CmsKind;
  name: string;
  config: Record<string, string>;
  created_at: string;
}

const SECRET_FIELDS = new Set([
  "app_password",
  "api_token",
  "admin_api_key",
  "integration_token",
  "bearer_token",
  "secret",
]);

export default function PublishingDestinations() {
  const { effectiveTenantId } = useSite();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKind, setFormKind] = useState<CmsKind>("wordpress");
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveTenantId) load();
  }, [effectiveTenantId]);

  const tenantHeaders = (): HeadersInit => ({ "X-Tenant-ID": effectiveTenantId });

  const load = async () => {
    setLoading(true);
    setDestinations([]);
    try {
      const res = await fetch("/api/integrations/destinations", { headers: tenantHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDestinations(data.destinations || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load destinations");
    }
    setLoading(false);
  };

  const startNew = () => {
    setEditingId(null);
    setFormKind("wordpress");
    setFormName("");
    setFormConfig({});
    setTestResult(null);
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormConfig({});
    setFormName("");
    setTestResult(null);
    setError(null);
  };

  const updateField = (key: string, value: string) => {
    setFormConfig((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: formKind, config: formConfig }),
      });
      const data = await res.json();
      setTestResult({ ok: !!data.ok, message: data.message });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : "Test failed" });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tenantHeaders() },
        body: JSON.stringify({
          id: editingId,
          kind: formKind,
          name: formName,
          config: formConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      await load();
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this destination?")) return;
    try {
      await fetch(`/api/integrations/destinations?id=${id}`, { method: "DELETE", headers: tenantHeaders() });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    }
  };

  const fields = KIND_META[formKind].fields;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
        <div className="flex items-start gap-2">
          <Globe className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-medium text-sm text-blue-900 mb-1">How CMS publishing works</p>
            <p>
              Connect WordPress, Webflow, Ghost, Notion or a custom webhook below. Then in
              Content, pick a destination and publish — SAMA pushes the post with full HTML,
              JSON-LD schema and metadata. You can also schedule for later.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500"><X className="h-4 w-4" /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {destinations.length === 0 ? (
            <p className="text-sm text-slate-500">No destinations yet. Add one to start publishing.</p>
          ) : (
            destinations.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <Send className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{d.name}</p>
                    <p className="text-xs text-slate-400">{KIND_META[d.kind]?.label || d.kind}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {!showForm && (
        <button
          onClick={startNew}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add destination
        </button>
      )}

      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingId ? "Edit destination" : "New destination"}
            </h3>
            <button onClick={closeForm} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select
                value={formKind}
                onChange={(e) => { setFormKind(e.target.value as CmsKind); setFormConfig({}); setTestResult(null); }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SUPPORTED_KINDS.map((k) => (
                  <option key={k} value={k}>{KIND_META[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Main blog"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const isSecret = f.type === "password" || SECRET_FIELDS.has(f.key);
              return (
                <div key={f.key} className={f.type === "url" || f.label.length > 25 ? "sm:col-span-2" : ""}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {f.label}{f.required ? " *" : ""}
                  </label>
                  <input
                    type={isSecret ? "password" : "text"}
                    value={formConfig[f.key] || ""}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    autoComplete={isSecret ? "new-password" : "off"}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              );
            })}
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${
              testResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {testResult.ok ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {testResult.ok ? "Connection OK" : testResult.message || "Connection failed"}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleTest}
              disabled={testing || !formName.trim()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Test
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formName.trim()}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
