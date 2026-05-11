"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

interface TemplateVar {
  name: string;
  description: string;
  sample: string;
}

interface Template {
  kind: string;
  name: string;
  subject: string;
  body_markdown: string;
  variables: TemplateVar[];
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("sv-SE");
}

export default function EmailTemplatesTab({
  onError,
  onNotice,
}: {
  onError: (m: string) => void;
  onNotice: (m: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKind, setSelectedKind] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email/templates", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { templates: Template[] };
      setTemplates(body.templates);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte ladda mallar");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => templates.find((t) => t.kind === selectedKind) || null,
    [templates, selectedKind],
  );

  if (selected) {
    return (
      <TemplateEditor
        template={selected}
        onBack={() => setSelectedKind(null)}
        onSaved={(t) => {
          setTemplates((prev) => prev.map((p) => (p.kind === t.kind ? t : p)));
          onNotice(`Mall "${t.name}" sparad.`);
        }}
        onError={onError}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <div>
          Mallarna lagras här i admin men kopplas inte automatiskt till det
          faktiska utskicket — sändlogiken (SAMA-backend) behöver läsa från
          den här tabellen för att ändringar ska slå igenom på riktigt.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar mallar…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Inga mallar. Kör <code>supabase-email-templates.sql</code> i Supabase
          SQL Editor för att seed-fylla tabellen.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <button
              key={t.kind}
              onClick={() => setSelectedKind(t.kind)}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:shadow-sm"
            >
              <div className="text-sm font-semibold text-slate-900">{t.name}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">{t.kind}</div>
              {t.description && (
                <div className="mt-2 line-clamp-2 text-xs text-slate-600">
                  {t.description}
                </div>
              )}
              <div className="mt-3 text-xs text-slate-400">
                Uppdaterad {fmtDate(t.updated_at)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({
  template,
  onBack,
  onSaved,
  onError,
}: {
  template: Template;
  onBack: () => void;
  onSaved: (t: Template) => void;
  onError: (m: string) => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyMd, setBodyMd] = useState(template.body_markdown);
  const [vars, setVars] = useState<TemplateVar[]>(template.variables ?? []);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const dirty =
    subject !== template.subject ||
    bodyMd !== template.body_markdown ||
    JSON.stringify(vars) !== JSON.stringify(template.variables ?? []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email/templates/${template.kind}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body_markdown: bodyMd, variables: vars }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { template: Template };
      onSaved(body.template);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte spara");
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch(
        `/api/admin/email/templates/${template.kind}/preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body_markdown: bodyMd }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { subject: string; html: string };
      setPreview(body);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Kunde inte rendera förhandsgranskning");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={runPreview}
            disabled={previewing}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {previewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Förhandsgranska
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Spara
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">{template.name}</h2>
        <p className="font-mono text-xs text-slate-500">{template.kind}</p>
        {template.description && (
          <p className="mt-1 text-sm text-slate-600">{template.description}</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Ämne</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ämnesrad…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Brödtext (markdown)
            </label>
            <textarea
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
              rows={16}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              placeholder="# Rubrik..."
            />
            <p className="mt-1 text-xs text-slate-500">
              Använd <code>{`{{namn}}`}</code> för variabler. Markdown stöds:
              rubriker, listor, tabeller, länkar, fet/kursiv.
            </p>
          </div>
          <VariableEditor vars={vars} onChange={setVars} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Förhandsgranskning
          </label>
          <div className="rounded-lg border border-slate-200 bg-white">
            {preview ? (
              <>
                <div className="border-b border-slate-200 px-4 py-2 text-xs">
                  <span className="text-slate-500">Ämne:</span>{" "}
                  <span className="font-medium text-slate-900">{preview.subject}</span>
                </div>
                <iframe
                  title="Förhandsgranskning"
                  srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px/1.6 -apple-system,BlinkMacSystemFont,sans-serif;color:#0f172a;padding:16px;max-width:600px;margin:0 auto}h1,h2,h3{margin-top:1.5em}table{border-collapse:collapse;margin:1em 0;width:100%}th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}th{background:#f8fafc}code{background:#f1f5f9;padding:1px 4px;border-radius:3px;font-size:0.9em}pre{background:#f1f5f9;padding:12px;border-radius:6px;overflow:auto}</style></head><body>${preview.html}</body></html>`}
                  sandbox=""
                  className="h-[480px] w-full"
                />
              </>
            ) : (
              <div className="p-8 text-center text-sm text-slate-500">
                Tryck &quot;Förhandsgranska&quot; för att se hur mailet ser ut
                med exempelvärdena nedan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function VariableEditor({
  vars,
  onChange,
}: {
  vars: TemplateVar[];
  onChange: (v: TemplateVar[]) => void;
}) {
  const update = (i: number, patch: Partial<TemplateVar>) =>
    onChange(vars.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const remove = (i: number) => onChange(vars.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([...vars, { name: "", description: "", sample: "" }]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Variabler</label>
        <button
          onClick={add}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
        >
          <Plus className="h-3 w-3" /> Lägg till
        </button>
      </div>
      <div className="mt-1 space-y-2">
        {vars.length === 0 && (
          <p className="text-xs text-slate-500">Inga variabler definierade.</p>
        )}
        {vars.map((v, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-lg border border-slate-200 p-2"
          >
            <div className="grid flex-1 grid-cols-3 gap-2">
              <input
                placeholder="namn"
                value={v.name}
                onChange={(e) => update(i, { name: e.target.value })}
                className="rounded border border-slate-200 px-2 py-1 font-mono text-xs"
              />
              <input
                placeholder="beskrivning"
                value={v.description}
                onChange={(e) => update(i, { description: e.target.value })}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              />
              <input
                placeholder="exempelvärde"
                value={v.sample}
                onChange={(e) => update(i, { sample: e.target.value })}
                className="rounded border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
            <button
              onClick={() => remove(i)}
              className="mt-1 text-slate-400 hover:text-red-600"
              title="Ta bort"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
