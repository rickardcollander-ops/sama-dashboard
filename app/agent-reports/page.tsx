"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw, Search, MessageSquare, TrendingUp, Users, BarChart3,
  BarChart2, CheckCircle2, AlertTriangle, XCircle, Lightbulb,
  Clock, Zap, Palette, Monitor,
} from "lucide-react";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "https://web-production-5324a.up.railway.app";

interface AgentReport {
  id?: string;
  agent_name: string;
  summary: string;
  highlights: string[];
  problems: string[];
  improvements: string[];
  ux_suggestions?: string[];
  stats: {
    actions_created?: number;
    actions_completed?: number;
    actions_pending?: number;
    actions_failed?: number;
    ooda_cycles?: number;
    cycles_completed?: number;
    cycles_failed?: number;
    alerts_raised?: number;
    learnings_recorded?: number;
  };
  created_at: string;
}

const AGENT_META: Record<string, { name: string; title: string; emoji: string; icon: React.ElementType; color: string }> = {
  seo:       { name: "NOVA",     title: "Search Intelligence",   emoji: "🔮", icon: Search,         color: "blue" },
  content:   { name: "MUSE",     title: "Creative Engine",        emoji: "✨", icon: MessageSquare,  color: "purple" },
  ads:       { name: "APEX",     title: "Performance Commander",  emoji: "🎯", icon: TrendingUp,     color: "green" },
  social:    { name: "ECHO",     title: "Social Pulse",           emoji: "📡", icon: Users,          color: "pink" },
  reviews:   { name: "SENTINEL", title: "Reputation Guardian",    emoji: "🛡️", icon: BarChart3,      color: "amber" },
  analytics: { name: "ORACLE",   title: "Data Prophet",           emoji: "📊", icon: BarChart2,      color: "cyan" },
};

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; light: string; gradient: string }> = {
  blue:   { bg: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    light: "bg-blue-100",    gradient: "from-blue-500 to-blue-600" },
  purple: { bg: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700",  light: "bg-purple-100",  gradient: "from-purple-500 to-purple-600" },
  green:  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", light: "bg-emerald-100", gradient: "from-emerald-500 to-emerald-600" },
  pink:   { bg: "bg-pink-50",    border: "border-pink-200",    text: "text-pink-700",    light: "bg-pink-100",    gradient: "from-pink-500 to-pink-600" },
  amber:  { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   light: "bg-amber-100",   gradient: "from-amber-500 to-amber-600" },
  cyan:   { bg: "bg-cyan-50",    border: "border-cyan-200",    text: "text-cyan-700",    light: "bg-cyan-100",    gradient: "from-cyan-500 to-cyan-600" },
};

function StatPill({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
      warn ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
    }`}>
      {label}: {value}
    </span>
  );
}

function AgentCard({ report }: { report: AgentReport }) {
  const meta = AGENT_META[report.agent_name] || { name: report.agent_name.toUpperCase(), title: "Agent", emoji: "🤖", icon: Zap, color: "blue" };
  const colors = COLOR_MAP[meta.color] || COLOR_MAP.blue;
  const Icon = meta.icon;
  const s = report.stats || {};

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${colors.gradient} text-white text-xl shadow-md`}>
          {meta.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-bold ${colors.text}`}>{meta.name}</h3>
          <p className="text-[11px] text-slate-400">{meta.title}</p>
          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {report.created_at ? new Date(report.created_at).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" }) : "—"}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="px-5 pb-3">
        <p className="text-sm text-slate-700 leading-relaxed">{report.summary || "Ingen sammanfattning tillgänglig."}</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-1.5 px-5 pb-3">
        {s.actions_created !== undefined && <StatPill label="Skapade" value={s.actions_created} />}
        {s.actions_completed !== undefined && <StatPill label="Klara" value={s.actions_completed} />}
        {(s.actions_failed ?? 0) > 0 && <StatPill label="Misslyckade" value={s.actions_failed!} warn />}
        {s.ooda_cycles !== undefined && <StatPill label="OODA" value={s.ooda_cycles} />}
        {s.learnings_recorded !== undefined && s.learnings_recorded > 0 && <StatPill label="Lärdomar" value={s.learnings_recorded} />}
      </div>

      {/* Highlights */}
      {report.highlights && report.highlights.length > 0 && (
        <div className="px-5 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Highlights</p>
          <ul className="space-y-1">
            {report.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Problems */}
      {report.problems && report.problems.length > 0 && (
        <div className="px-5 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Problem</p>
          <ul className="space-y-1">
            {report.problems.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvements */}
      {report.improvements && report.improvements.length > 0 && (
        <div className="border-t px-5 py-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-1 flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> Systemförbättringar
          </p>
          <ul className="space-y-1">
            {report.improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* UX Suggestions */}
      {report.ux_suggestions && report.ux_suggestions.length > 0 && (
        <div className="border-t px-5 py-3" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 mb-1 flex items-center gap-1">
            <Palette className="h-3 w-3" /> UX-förbättringar
          </p>
          <ul className="space-y-1">
            {report.ux_suggestions.map((ux, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                <Monitor className="h-3.5 w-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                <span>{ux}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AgentReportsPage() {
  const [reports, setReports] = useState<AgentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/agents/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const generateReports = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${SAMA_API_URL}/api/agents/reports/generate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch { /* silent */ }
    setGenerating(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const totalImprovements = reports.reduce((sum, r) => sum + (r.improvements?.length || 0), 0);
  const totalProblems = reports.reduce((sum, r) => sum + (r.problems?.length || 0), 0);
  const totalUx = reports.reduce((sum, r) => sum + (r.ux_suggestions?.length || 0), 0);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agentrapporter</h1>
          <p className="text-sm text-slate-500">
            Daglig statusrapport — vad varje agent gjort och vad de behöver
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReports}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Uppdatera
          </button>
          <button
            onClick={generateReports}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Zap className={`h-4 w-4 ${generating ? "animate-pulse" : ""}`} />
            {generating ? "Genererar..." : "Generera rapporter"}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {reports.length > 0 && (
        <div className="flex flex-wrap gap-4 rounded-xl border bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Agenter:</span>
            <span className="text-sm font-semibold text-slate-900">{reports.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-slate-500">Systemförslag:</span>
            <span className="text-sm font-semibold text-amber-700">{totalImprovements}</span>
          </div>
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-500" />
            <span className="text-sm text-slate-500">UX-förslag:</span>
            <span className="text-sm font-semibold text-violet-700">{totalUx}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-slate-500">Problem:</span>
            <span className="text-sm font-semibold text-red-700">{totalProblems}</span>
          </div>
        </div>
      )}

      {/* Reports grid */}
      {reports.length === 0 && !loading && (
        <div className="rounded-xl border bg-white p-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-slate-300" />
          <p className="mt-4 text-sm text-slate-500">Inga rapporter genererade ännu.</p>
          <button
            onClick={generateReports}
            disabled={generating}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Generera första rapporterna
          </button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {reports.map((r) => (
          <AgentCard key={r.agent_name || r.id} report={r} />
        ))}
      </div>
    </div>
  );
}
