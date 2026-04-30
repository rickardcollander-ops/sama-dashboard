"use client";

import { useState, ReactNode } from "react";
import { Loader2, Sparkles, X, CheckCircle, AlertCircle } from "lucide-react";

export interface SuggestionItem {
  // Free-form payload — each page renders + imports its own shape
  [key: string]: any;
}

interface Props<T extends SuggestionItem> {
  title: string;
  description: string;
  /** Color theme matched to the agent (e.g. "purple", "indigo", "orange"). */
  accent: "purple" | "indigo" | "orange" | "slate";
  /** Generates the list of suggestions (e.g. POST /api/content/suggest-topics). */
  fetchSuggestions: () => Promise<T[]>;
  /** Renders the body of one suggestion card. */
  renderItem: (item: T) => ReactNode;
  /** Imports a suggestion into the agent. Returns a short success message. */
  importItem: (item: T) => Promise<string>;
  /** Title displayed in the import-confirmation modal. */
  importLabel?: string;
  /** Verb shown on the import button per item, e.g. "Importera till Content". */
  importButtonLabel: string;
}

const ACCENT: Record<string, { bg: string; text: string; border: string; solid: string; solidHover: string; ring: string }> = {
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", solid: "bg-purple-600", solidHover: "hover:bg-purple-700", ring: "focus:ring-purple-500" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", solid: "bg-indigo-600", solidHover: "hover:bg-indigo-700", ring: "focus:ring-indigo-500" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", solid: "bg-orange-600", solidHover: "hover:bg-orange-700", ring: "focus:ring-orange-500" },
  slate:  { bg: "bg-slate-100", text: "text-slate-800", border: "border-slate-300", solid: "bg-slate-800",  solidHover: "hover:bg-slate-900",  ring: "focus:ring-slate-500" },
};

export default function SuggestionsPanel<T extends SuggestionItem>({
  title, description, accent,
  fetchSuggestions, renderItem, importItem,
  importLabel = "Importera förslag",
  importButtonLabel,
}: Props<T>) {
  const c = ACCENT[accent];

  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<T | null>(null);
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchSuggestions();
      setSuggestions(items);
      if (!items.length) setError("Inga förslag returnerades. Försök igen om en stund.");
    } catch (err: any) {
      setError(err?.message || "Kunde inte hämta förslag.");
    }
    setLoading(false);
  };

  const confirmImport = async () => {
    if (!pending) return;
    setImporting(true);
    setImportError(null);
    try {
      const msg = await importItem(pending);
      setFeedback(msg);
      // Remove imported item from the list
      setSuggestions((prev) => prev.filter((s) => s !== pending));
      setPending(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setImportError(err?.message || "Kunde inte importera.");
    }
    setImporting(false);
  };

  return (
    <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${c.text}`} />
            {title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className={`flex items-center gap-2 rounded-lg ${c.solid} ${c.solidHover} px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-50 transition-colors`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Hämtar..." : suggestions.length > 0 ? "Hämta nya förslag" : "Föreslå med AI"}
        </button>
      </div>

      {feedback && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          {feedback}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((item, idx) => (
            <div key={idx} className={`rounded-lg border ${c.border} ${c.bg} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">{renderItem(item)}</div>
                <button
                  onClick={() => setPending(item)}
                  className={`flex-shrink-0 rounded-lg ${c.solid} ${c.solidHover} px-3 py-1.5 text-xs font-medium text-white transition-colors`}
                >
                  {importButtonLabel}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modal */}
      {pending && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => !importing && setPending(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-lg rounded-2xl border bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Sparkles className={`h-5 w-5 ${c.text}`} />
                  {importLabel}
                </h3>
                <button
                  onClick={() => !importing && setPending(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className={`rounded-lg border ${c.border} ${c.bg} p-4 mb-4`}>
                {renderItem(pending)}
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Vill du importera detta till agenten? Agenten kommer att skapa ett utkast som du kan granska innan publicering.
              </p>

              {importError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {importError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setPending(null)}
                  disabled={importing}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importing}
                  className={`flex items-center gap-2 rounded-lg ${c.solid} ${c.solidHover} px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors`}
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  {importing ? "Importerar..." : "Importera"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
