"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, Calendar, CheckCircle, ExternalLink, Loader2, Mail, Send, X,
} from "lucide-react";
import { CmsKind } from "@/lib/integrations/cms/types";
import { KIND_META } from "@/lib/integrations/cms";
import { useSite } from "@/lib/hooks/useSite";

interface Destination {
  id: string;
  kind: CmsKind;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  pieceId?: string;
  defaultExcerpt?: string;
  defaultTags?: string[];
  /** Default recipient for the mail path (read from settings if available). */
  defaultMailRecipient?: string;
}

type PublishPath = "cms" | "mail";

export default function PublishDialog(props: Props) {
  const {
    open, onClose, title, body, pieceId, defaultExcerpt, defaultTags,
    defaultMailRecipient,
  } = props;

  const { effectiveTenantId } = useSite();
  const tenantHeaders = (): HeadersInit => ({ "X-Tenant-ID": effectiveTenantId });

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState<PublishPath>("cms");

  // CMS state
  const [destinationId, setDestinationId] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [excerpt, setExcerpt] = useState(defaultExcerpt || "");
  const [tagInput, setTagInput] = useState((defaultTags || []).join(", "));
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url?: string; scheduled?: boolean; mailed?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mail state
  const [mailTo, setMailTo] = useState(defaultMailRecipient || "");
  const [mailSubject, setMailSubject] = useState(title || "");
  const [mailNote, setMailNote] = useState(
    "Hej,\n\nDetta utkast är godkänt och redo att publiceras. Bifogat finns innehållet i sin helhet.\n\nTack på förhand.",
  );

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setLoading(true);
    setMailTo(defaultMailRecipient || "");
    setMailSubject(title || "");
    fetch("/api/integrations/destinations", { headers: tenantHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setDestinations(d.destinations || []);
        if (d.destinations?.[0]) setDestinationId(d.destinations[0].id);
        // If no CMS connected, default to the mail path so the user has a way out
        if (!d.destinations?.length) setPath("mail");
      })
      .catch(() => setDestinations([]))
      .finally(() => setLoading(false));
  }, [open, title, defaultMailRecipient, effectiveTenantId]);

  if (!open) return null;

  const handlePublishCms = async () => {
    setPublishing(true);
    setError(null);
    try {
      const tags = tagInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: Record<string, unknown> = {
        destination_id: destinationId,
        title,
        body_markdown: body,
        excerpt,
        tags,
        piece_id: pieceId,
      };
      if (scheduleEnabled && scheduleAt) {
        payload.scheduled_at = new Date(scheduleAt).toISOString();
      }
      const res = await fetch("/api/integrations/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tenantHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publicering misslyckades");
      if (data.scheduled) {
        setResult({ scheduled: true });
      } else {
        setResult({ url: data.result?.url });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publicering misslyckades");
    }
    setPublishing(false);
  };

  // Open the user's mail client with the content prefilled. No backend needed
  // for v1 — mail-as-a-service can replace this later by POSTing to
  // /api/integrations/publish-via-mail.
  const handlePublishMail = () => {
    setError(null);
    if (!mailTo.trim()) {
      setError("Ange minst en mottagare.");
      return;
    }
    const intro = mailNote.trim();
    const fullBody = `${intro}${intro ? "\n\n" : ""}---\n\n# ${title}\n\n${body}`;
    const url =
      `mailto:${encodeURIComponent(mailTo.trim())}` +
      `?subject=${encodeURIComponent(mailSubject)}` +
      `&body=${encodeURIComponent(fullBody)}`;
    // Some browsers cap mailto: length; if it's enormous, fall back to plain
    // mailto with just a note pointing to the portal.
    if (url.length > 8000) {
      const fallback =
        `mailto:${encodeURIComponent(mailTo.trim())}` +
        `?subject=${encodeURIComponent(mailSubject)}` +
        `&body=${encodeURIComponent(`${intro}\n\nInnehållet är för stort för att skickas via mailto. Öppna utkastet i SAMA och kopiera in det.`)}`;
      window.location.href = fallback;
    } else {
      window.location.href = url;
    }
    setResult({ mailed: true });
  };

  const noCms = !loading && destinations.length === 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Publicera
            </h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              aria-label="Stäng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Path tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setPath("cms")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                path === "cms"
                  ? "text-blue-700 border-b-2 border-blue-600 -mb-px"
                  : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
              }`}
            >
              <Send className="inline h-3.5 w-3.5 mr-1.5" />
              Direkt till CMS
              {noCms && (
                <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                  ej anslutet
                </span>
              )}
            </button>
            <button
              onClick={() => setPath("mail")}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                path === "mail"
                  ? "text-blue-700 border-b-2 border-blue-600 -mb-px"
                  : "text-slate-500 hover:text-slate-900 border-b-2 border-transparent"
              }`}
            >
              <Mail className="inline h-3.5 w-3.5 mr-1.5" />
              Skicka via mail
            </button>
          </div>

          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : path === "cms" ? (
              <CmsForm
                destinations={destinations}
                destinationId={destinationId}
                setDestinationId={setDestinationId}
                excerpt={excerpt}
                setExcerpt={setExcerpt}
                tagInput={tagInput}
                setTagInput={setTagInput}
                scheduleEnabled={scheduleEnabled}
                setScheduleEnabled={setScheduleEnabled}
                scheduleAt={scheduleAt}
                setScheduleAt={setScheduleAt}
                publishing={publishing}
                error={error}
                result={result}
                onPublish={handlePublishCms}
              />
            ) : (
              <MailForm
                mailTo={mailTo}
                setMailTo={setMailTo}
                mailSubject={mailSubject}
                setMailSubject={setMailSubject}
                mailNote={mailNote}
                setMailNote={setMailNote}
                error={error}
                result={result}
                onSend={handlePublishMail}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CmsForm(props: {
  destinations: Destination[];
  destinationId: string;
  setDestinationId: (v: string) => void;
  excerpt: string;
  setExcerpt: (v: string) => void;
  tagInput: string;
  setTagInput: (v: string) => void;
  scheduleEnabled: boolean;
  setScheduleEnabled: (v: boolean) => void;
  scheduleAt: string;
  setScheduleAt: (v: string) => void;
  publishing: boolean;
  error: string | null;
  result: { url?: string; scheduled?: boolean; mailed?: boolean } | null;
  onPublish: () => void;
}) {
  const {
    destinations, destinationId, setDestinationId,
    excerpt, setExcerpt, tagInput, setTagInput,
    scheduleEnabled, setScheduleEnabled, scheduleAt, setScheduleAt,
    publishing, error, result, onPublish,
  } = props;

  if (destinations.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Inget CMS anslutet ännu. Öppna{" "}
        <Link className="font-medium underline" href="/c/settings/integrations">
          Integrationer
        </Link>{" "}
        för att lägga till WordPress, Webflow, Ghost eller en webhook — eller välj fliken{" "}
        <strong>Skicka via mail</strong> ovan för att skicka utkastet till någon som publicerar.
      </div>
    );
  }

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Destination</label>
        <select
          value={destinationId}
          onChange={(e) => setDestinationId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {KIND_META[d.kind]?.label || d.kind}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Ingress</label>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Taggar (komma-separerade)</label>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="seo, ai, content"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
          />
          <Calendar className="h-4 w-4 text-slate-500" />
          Schemalägg
        </label>
        {scheduleEnabled && (
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {result?.scheduled && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4" /> Schemalagt — publiceras vid vald tid.
        </div>
      )}
      {result?.url && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4" />
          Publicerat!
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 underline"
          >
            Öppna <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {!result && (
        <button
          onClick={onPublish}
          disabled={publishing || !destinationId || (scheduleEnabled && !scheduleAt)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {scheduleEnabled ? "Schemalägg" : "Publicera nu"}
        </button>
      )}
    </>
  );
}

function MailForm(props: {
  mailTo: string;
  setMailTo: (v: string) => void;
  mailSubject: string;
  setMailSubject: (v: string) => void;
  mailNote: string;
  setMailNote: (v: string) => void;
  error: string | null;
  result: { url?: string; scheduled?: boolean; mailed?: boolean } | null;
  onSend: () => void;
}) {
  const { mailTo, setMailTo, mailSubject, setMailSubject, mailNote, setMailNote, error, result, onSend } = props;

  return (
    <>
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        Skickar utkastet till mottagaren via ditt mail-program. Innehållet klistras in
        nedanför ditt följebrev så att hen kan publicera direkt.
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Till</label>
        <input
          type="email"
          value={mailTo}
          onChange={(e) => setMailTo(e.target.value)}
          placeholder="webmaster@kunden.se"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Standardmottagare kan sparas under Inställningar → Konto.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Ämnesrad</label>
        <input
          value={mailSubject}
          onChange={(e) => setMailSubject(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Följebrev</label>
        <textarea
          value={mailNote}
          onChange={(e) => setMailNote(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {result?.mailed && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4" /> Mail-program öppnat — granska och skicka iväg från ditt vanliga klient.
        </div>
      )}

      <button
        onClick={onSend}
        disabled={!mailTo.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
      >
        <Mail className="h-4 w-4" />
        Öppna i mail
      </button>
    </>
  );
}
