"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle, Check, Loader2, Sparkles, X, Wand2,
} from "lucide-react";
import { tenantApi } from "@/lib/api";

// Sprint 4 (C5) — Förbättra med AI dialog.
//
// Loads the full body of a piece, lets the user pick an intent (grammar /
// tone / SEO / shorten / expand) and shows the original + refined text side
// by side. "Behåll förbättringen" PATCH-uppdaterar pieces.

interface PieceFull {
  id: string;
  title?: string;
  body?: string;
  content?: string;
  markdown?: string;
  target_keyword?: string;
  target_audience?: string;
}

interface RefineResponse {
  piece_id: string;
  intent: string;
  refined_text: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  pieceId: string;
  /** Called after the user keeps the rewrite. */
  onSaved?: () => void;
}

const INTENTS: { id: string; label: string; description: string }[] = [
  { id: "grammar", label: "Grammatik", description: "Putsa språk och formulering, behåll innehållet." },
  { id: "tone", label: "Tonalitet", description: "Mer naturlig ton, mindre säljig." },
  { id: "seo", label: "SEO-täckning", description: "Förbättrade rubriker och naturlig nyckelordsanvändning." },
  { id: "shorten", label: "Förkorta", description: "Cirka 70% av nuvarande längd." },
  { id: "expand", label: "Utveckla", description: "Lägg till exempel och en skarpare avslutning." },
];

export default function RefineDialog({ open, onClose, tenantId, pieceId, onSaved }: Props) {
  const [piece, setPiece] = useState<PieceFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState<string>("grammar");
  const [refining, setRefining] = useState(false);
  const [refined, setRefined] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setPiece(null);
      setRefined(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setRefined(null);
    (async () => {
      try {
        const data = await tenantApi(tenantId).get<{ piece?: PieceFull }>(
          `/api/content/pieces/${pieceId}`,
        );
        const p = data?.piece || (data as unknown as PieceFull) || null;
        setPiece(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunde inte hämta innehåll");
      }
      setLoading(false);
    })();
  }, [open, tenantId, pieceId]);

  if (!open) return null;

  const body = piece?.body || piece?.content || piece?.markdown || "";

  const handleRefine = async () => {
    if (!body) {
      setError("Inget innehåll att förbättra.");
      return;
    }
    setRefining(true);
    setError(null);
    try {
      const res = await tenantApi(tenantId).post<RefineResponse>(
        `/api/content/pieces/${pieceId}/refine`,
        {
          text: body,
          intent,
          target_keyword: piece?.target_keyword,
          audience: piece?.target_audience,
        },
      );
      setRefined(res.refined_text || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte förbättra texten");
    }
    setRefining(false);
  };

  const handleKeep = async () => {
    if (!refined) return;
    setSaving(true);
    setError(null);
    try {
      await tenantApi(tenantId).patch(`/api/content/pieces/${pieceId}`, {
        content: refined,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunde inte spara den förbättrade texten");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex w-full max-w-5xl max-h-[90vh] flex-col rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Wand2 className="h-5 w-5 text-purple-500" />
              Förbättra med AI
            </h3>
            <button
              onClick={onClose}
              aria-label="Stäng"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Hämtar innehåll…
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {piece && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Vad vill du förbättra?
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {INTENTS.map((it) => {
                      const active = intent === it.id;
                      return (
                        <button
                          key={it.id}
                          onClick={() => setIntent(it.id)}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            active
                              ? "border-purple-300 bg-purple-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                        >
                          <p
                            className={`text-sm font-medium ${
                              active ? "text-purple-700" : "text-slate-800"
                            }`}
                          >
                            {it.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">{it.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <button
                    onClick={handleRefine}
                    disabled={refining || !body}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300"
                  >
                    {refining ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {refining ? "Förbättrar…" : refined ? "Försök igen" : "Förbättra texten"}
                  </button>
                </div>

                {/* Side-by-side */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Original
                    </p>
                    <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 font-sans">
                      {body || "Inget innehåll laddat."}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Förbättrad version
                    </p>
                    {refined ? (
                      <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-sm leading-relaxed text-slate-800 font-sans">
                        {refined}
                      </pre>
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-400">
                        Klicka &quot;Förbättra texten&quot; för att se en förbättrad version här.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              Stäng
            </button>
            <button
              onClick={handleKeep}
              disabled={!refined || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Behåll förbättringen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

