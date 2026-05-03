"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, X, Calendar, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { CmsKind } from "@/lib/integrations/cms/types";
import { KIND_META } from "@/lib/integrations/cms";

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
}

export default function PublishDialog(props: Props) {
  const { open, onClose, title, body, pieceId, defaultExcerpt, defaultTags } = props;
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [destinationId, setDestinationId] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [excerpt, setExcerpt] = useState(defaultExcerpt || "");
  const [tagInput, setTagInput] = useState((defaultTags || []).join(", "));
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url?: string; scheduled?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    setLoading(true);
    fetch("/api/integrations/destinations")
      .then((r) => r.json())
      .then((d) => {
        setDestinations(d.destinations || []);
        if (d.destinations?.[0]) setDestinationId(d.destinations[0].id);
      })
      .catch(() => setDestinations([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const handlePublish = async () => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      if (data.scheduled) {
        setResult({ scheduled: true });
      } else {
        setResult({ url: data.result?.url });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    }
    setPublishing(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Publish to CMS
            </h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : destinations.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                No destinations connected yet. Go to{" "}
                <a className="font-medium underline" href="/c/settings#destinations">Settings → CMS Destinations</a>{" "}
                to add WordPress, Webflow, Ghost, Notion or a webhook.
              </div>
            ) : (
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Excerpt</label>
                  <textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma separated)</label>
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
                    Schedule for later
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
                    <CheckCircle className="h-4 w-4" /> Scheduled — will publish at the selected time.
                  </div>
                )}
                {result?.url && (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <CheckCircle className="h-4 w-4" />
                    Published!
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {!result && (
                  <button
                    onClick={handlePublish}
                    disabled={publishing || !destinationId || (scheduleEnabled && !scheduleAt)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {scheduleEnabled ? "Schedule" : "Publish now"}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
