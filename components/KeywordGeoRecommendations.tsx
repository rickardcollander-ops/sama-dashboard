"use client";

import { useState } from "react";
import {
  Sparkles, Loader2, Plus, CheckCircle, AlertCircle, X, Search, Bot, MessageSquare,
} from "lucide-react";
import { samaHeaders } from "@/lib/api";

interface RecommendationItem {
  text: string;
  reason: string;
  intent?: string;
  type?: string;
  priority?: "high" | "medium" | "low";
}

interface Recommendations {
  keywords: RecommendationItem[];
  geo_queries: RecommendationItem[];
  long_tail_phrases: RecommendationItem[];
}

interface Props {
  /** Currently tracked SEO keywords (so the AI doesn't suggest duplicates). */
  existingKeywords?: string[];
  /** Free-text summary of recent analysis gaps to bias suggestions. */
  gapSummary?: string;
  /** Sections to surface — defaults to all three. */
  sections?: ("keywords" | "geo_queries" | "long_tail_phrases")[];
  /** Optional callback after items are added (refresh parent). */
  onAdded?: (added: { geo: number; keywords: number }) => void;
  /** Compact rendering for sidebars. */
  compact?: boolean;
  /** Header title — defaults to "AI keyword & GEO recommendations". */
  title?: string;
  description?: string;
  /** How many GEO queries the tenant is already tracking (for the cap). */
  geoTrackedCount?: number;
  /** Maximum GEO queries allowed under monitoring (server-enforced). */
  geoMax?: number;
}

const SECTION_META: Record<
  "keywords" | "geo_queries" | "long_tail_phrases",
  { label: string; description: string; icon: typeof Search; tone: string; addBucket: "keywords" | "geo" }
> = {
  keywords: {
    label: "SEO Keywords",
    description: "Short search terms for Google rankings.",
    icon: Search,
    tone: "blue",
    addBucket: "keywords",
  },
  geo_queries: {
    label: "GEO Queries",
    description: "Natural-language prompts to track in AI assistants.",
    icon: Bot,
    tone: "violet",
    addBucket: "geo",
  },
  long_tail_phrases: {
    label: "Long-tail phrases",
    description: "5+ word buyer-intent phrases — also added as keywords.",
    icon: MessageSquare,
    tone: "emerald",
    addBucket: "keywords",
  },
};

const TONE: Record<string, { bg: string; border: string; text: string; chipBg: string; chipText: string }> = {
  blue:    { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    chipBg: "bg-blue-100",    chipText: "text-blue-700" },
  violet:  { bg: "bg-violet-50",  border: "border-violet-200",  text: "text-violet-700",  chipBg: "bg-violet-100",  chipText: "text-violet-700" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
};

const PRIORITY_TONE: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-100",
  medium: "bg-amber-50 text-amber-700 border-amber-100",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

export default function KeywordGeoRecommendations(props: Props) {
  const {
    existingKeywords = [], gapSummary, onAdded, compact, title, description,
    geoTrackedCount, geoMax,
  } = props;
  const sections = props.sections || ["keywords", "geo_queries", "long_tail_phrases"];

  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<{ geo: number; keywords: number; skipped: number; geoSkippedFull: number } | null>(null);

  const geoCapEnabled = typeof geoMax === "number" && typeof geoTrackedCount === "number";
  const geoRemaining = geoCapEnabled ? Math.max(0, (geoMax as number) - (geoTrackedCount as number)) : Infinity;
  const selectedGeoCount = Array.from(selected).filter((id) => id.startsWith("geo_queries::")).length;
  const exceedsGeoCap = geoCapEnabled && selectedGeoCount > geoRemaining;

  const fetchRecs = async () => {
    setLoading(true);
    setError(null);
    setAdded(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sama-Intent": "user-action",
          ...samaHeaders(),
        },
        body: JSON.stringify({
          existing_keywords: existingKeywords,
          gap_summary: gapSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setRecs({
        keywords: data.keywords || [],
        geo_queries: data.geo_queries || [],
        long_tail_phrases: data.long_tail_phrases || [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get suggestions");
    }
    setLoading(false);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllInSection = (section: "keywords" | "geo_queries" | "long_tail_phrases") => {
    if (!recs) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of recs[section]) next.add(`${section}::${item.text}`);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!recs || selected.size === 0) return;
    setAdding(true);
    setError(null);
    const keywords: string[] = [];
    const geo_queries: string[] = [];
    for (const id of selected) {
      const [section, ...rest] = id.split("::");
      const text = rest.join("::");
      const meta = SECTION_META[section as keyof typeof SECTION_META];
      if (!meta) continue;
      if (meta.addBucket === "keywords") keywords.push(text);
      else geo_queries.push(text);
    }
    try {
      const res = await fetch("/api/recommendations/add", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...samaHeaders() },
        body: JSON.stringify({ keywords, geo_queries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Add failed");
      const result = {
        geo: data.geo_added || 0,
        keywords: data.keywords_added || 0,
        skipped: data.keywords_skipped || 0,
        geoSkippedFull: data.geo_skipped_full || 0,
      };
      setAdded(result);
      // Remove added items from the list
      setRecs((prev) => {
        if (!prev) return prev;
        const filterFn = (section: "keywords" | "geo_queries" | "long_tail_phrases") =>
          (item: RecommendationItem) => !selected.has(`${section}::${item.text}`);
        return {
          keywords: prev.keywords.filter(filterFn("keywords")),
          geo_queries: prev.geo_queries.filter(filterFn("geo_queries")),
          long_tail_phrases: prev.long_tail_phrases.filter(filterFn("long_tail_phrases")),
        };
      });
      setSelected(new Set());
      onAdded?.({ geo: result.geo, keywords: result.keywords });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    }
    setAdding(false);
  };

  const totalShown = recs
    ? sections.reduce((sum, s) => sum + recs[s].length, 0)
    : 0;

  return (
    <section className={`rounded-xl border bg-white ${compact ? "p-4" : "p-6"} shadow-sm`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            {title || "AI keyword & GEO recommendations"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {description ||
              "AI-suggested new keywords, GEO queries and long-tail phrases. Pick the ones you want to start tracking."}
          </p>
        </div>
        <button
          onClick={fetchRecs}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Generating..." : recs ? "Generate again" : "Suggest with AI"}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-3 w-3" /></button>
        </div>
      )}

      {added && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4" />
          Added {added.keywords} keyword{added.keywords === 1 ? "" : "s"} and {added.geo} GEO quer{added.geo === 1 ? "y" : "ies"}.
          {added.skipped > 0 ? ` ${added.skipped} skipped.` : ""}
          {added.geoSkippedFull > 0
            ? ` ${added.geoSkippedFull} GEO quer${added.geoSkippedFull === 1 ? "y" : "ies"} skipped — tracking cap reached.`
            : ""}
        </div>
      )}

      {!recs && !loading && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/40 p-6 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">
            Click <em>Suggest with AI</em> to discover new keywords and GEO queries based on your brand context
            {gapSummary ? " and recent analysis results" : ""}.
          </p>
        </div>
      )}

      {recs && totalShown === 0 && (
        <p className="text-sm text-slate-400">No new suggestions — all generated items are already tracked.</p>
      )}

      {recs && totalShown > 0 && (
        <>
          <div className={`grid gap-4 ${sections.length === 3 && !compact ? "lg:grid-cols-3" : sections.length >= 2 && !compact ? "sm:grid-cols-2" : ""}`}>
            {sections.map((section) => {
              const items = recs[section];
              if (!items || items.length === 0) return null;
              const meta = SECTION_META[section];
              const Icon = meta.icon;
              const tone = TONE[meta.tone];
              return (
                <div key={section} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${tone.text}`} />
                      <span className="text-sm font-semibold text-slate-800">{meta.label}</span>
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{items.length}</span>
                    </div>
                    <button
                      onClick={() => selectAllInSection(section)}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                    >
                      Select all
                    </button>
                  </div>
                  <ul className="space-y-1.5">
                    {items.map((item) => {
                      const id = `${section}::${item.text}`;
                      const isSel = selected.has(id);
                      return (
                        <li
                          key={id}
                          className={`flex items-start gap-2 rounded-lg border p-2 transition-colors cursor-pointer ${
                            isSel ? `${tone.border} ${tone.bg}` : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                          onClick={() => toggle(id)}
                        >
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggle(id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-medium text-slate-900 break-words">{item.text}</span>
                              {item.priority && (
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${PRIORITY_TONE[item.priority] || ""}`}>
                                  {item.priority}
                                </span>
                              )}
                              {item.intent && (
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tone.chipBg} ${tone.chipText}`}>
                                  {item.intent}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{item.reason}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-500 space-y-0.5">
              <p>
                {selected.size === 0 ? "Select items to add" : `${selected.size} selected`}
              </p>
              {geoCapEnabled && (
                <p className={exceedsGeoCap ? "text-amber-700 font-medium" : "text-slate-400"}>
                  GEO tracking: {geoTrackedCount}/{geoMax} used
                  {selectedGeoCount > 0
                    ? ` · ${selectedGeoCount} selected${exceedsGeoCap ? ` (only ${geoRemaining} will be added)` : ""}`
                    : ""}
                </p>
              )}
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || selected.size === 0}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add selected to tracking
            </button>
          </div>
        </>
      )}
    </section>
  );
}
