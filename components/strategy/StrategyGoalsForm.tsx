"use client";

import { useState } from "react";
import {
  Target, TrendingUp, Users, FileText, Linkedin, Mail,
  AlertTriangle, ChevronDown, ChevronUp, CheckCircle2,
} from "lucide-react";

export interface StrategyGoals {
  primary_goal: "traffic" | "brand" | "leads" | "seo" | "social" | "custom";
  custom_goal_text: string;
  content_types: Array<"blog_post" | "linkedin" | "epost">;
  posts_per_week_blog: number;
  posts_per_week_linkedin: number;
  newsletters_per_month: number;
  plan_start_date: string;
  include_audit_findings: boolean;
  assigned_members: string[];
}

interface AuditFinding {
  title: string;
  severity: "critical" | "warning" | "info";
  category?: string;
}

interface Props {
  initialGoals?: Partial<StrategyGoals>;
  teamMembers: string[];
  auditFindings: AuditFinding[];
  auditLoading: boolean;
  onSubmit: (goals: StrategyGoals) => void;
}

const PRIMARY_GOALS = [
  { value: "traffic", label: "Öka trafik", desc: "Fler besökare till hemsidan via SEO & content", icon: TrendingUp },
  { value: "leads", label: "Generera leads", desc: "Fler kontaktförfrågningar och konverteringar", icon: Target },
  { value: "brand", label: "Bygga varumärke", desc: "Stärka kännedom och trovärdighet", icon: CheckCircle2 },
  { value: "seo", label: "Förbättra SEO", desc: "Bättre positioner i Google", icon: TrendingUp },
  { value: "social", label: "Sociala medier", desc: "Bygga följarskap och engagemang", icon: Users },
  { value: "custom", label: "Eget mål", desc: "Beskriv ditt specifika mål nedan", icon: Target },
] as const;

const CONTENT_TYPE_META = {
  blog_post: { label: "Blogginlägg", icon: FileText, color: "blue" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "indigo" },
  epost: { label: "E-post / nyhetsbrev", icon: Mail, color: "amber" },
} as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function StrategyGoalsForm({ initialGoals, teamMembers, auditFindings, auditLoading, onSubmit }: Props) {
  const [primaryGoal, setPrimaryGoal] = useState<StrategyGoals["primary_goal"]>(initialGoals?.primary_goal ?? "traffic");
  const [customGoalText, setCustomGoalText] = useState(initialGoals?.custom_goal_text ?? "");
  const [contentTypes, setContentTypes] = useState<StrategyGoals["content_types"]>(
    initialGoals?.content_types ?? ["blog_post"]
  );
  const [postsPerWeekBlog, setPostsPerWeekBlog] = useState(initialGoals?.posts_per_week_blog ?? 1);
  const [postsPerWeekLinkedin, setPostsPerWeekLinkedin] = useState(initialGoals?.posts_per_week_linkedin ?? 3);
  const [newslettersPerMonth, setNewslettersPerMonth] = useState(initialGoals?.newsletters_per_month ?? 1);
  const [planStartDate, setPlanStartDate] = useState(initialGoals?.plan_start_date ?? today());
  const [includeAudit, setIncludeAudit] = useState(initialGoals?.include_audit_findings ?? true);
  const [assignedMembers, setAssignedMembers] = useState<string[]>(initialGoals?.assigned_members ?? []);
  const [auditExpanded, setAuditExpanded] = useState(false);

  const toggleContentType = (t: StrategyGoals["content_types"][number]) => {
    setContentTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const toggleMember = (m: string) => {
    setAssignedMembers((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const criticalCount = auditFindings.filter((f) => f.severity === "critical").length;
  const warningCount = auditFindings.filter((f) => f.severity === "warning").length;

  const handleSubmit = () => {
    if (contentTypes.length === 0) return;
    onSubmit({
      primary_goal: primaryGoal,
      custom_goal_text: customGoalText,
      content_types: contentTypes,
      posts_per_week_blog: contentTypes.includes("blog_post") ? postsPerWeekBlog : 0,
      posts_per_week_linkedin: contentTypes.includes("linkedin") ? postsPerWeekLinkedin : 0,
      newsletters_per_month: contentTypes.includes("epost") ? newslettersPerMonth : 0,
      plan_start_date: planStartDate,
      include_audit_findings: includeAudit,
      assigned_members: assignedMembers,
    });
  };

  return (
    <div className="space-y-8">
      {/* Step 1: Primary goal */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Vad är ditt primära mål?</h2>
        <p className="text-sm text-slate-500 mb-4">Strategin och planen anpassas utifrån ditt svar.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRIMARY_GOALS.map(({ value, label, desc, icon: Icon }) => {
            const selected = primaryGoal === value;
            return (
              <button
                key={value}
                onClick={() => setPrimaryGoal(value)}
                className={`flex flex-col gap-1 rounded-lg border-2 p-3 text-left transition-all ${
                  selected
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${selected ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-medium ${selected ? "text-emerald-700" : "text-slate-700"}`}>{label}</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">{desc}</p>
              </button>
            );
          })}
        </div>
        {primaryGoal === "custom" && (
          <textarea
            value={customGoalText}
            onChange={(e) => setCustomGoalText(e.target.value)}
            placeholder="Beskriv ditt mål…"
            rows={2}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        )}
      </section>

      {/* Step 2: Content types & volume */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Vilket innehåll ska skapas?</h2>
        <p className="text-sm text-slate-500 mb-4">Välj typer och ange hur ofta.</p>
        <div className="space-y-4">
          {(Object.entries(CONTENT_TYPE_META) as [StrategyGoals["content_types"][number], typeof CONTENT_TYPE_META[keyof typeof CONTENT_TYPE_META]][]).map(([type, meta]) => {
            const selected = contentTypes.includes(type);
            const Icon = meta.icon;
            return (
              <div key={type} className={`rounded-lg border-2 transition-all ${selected ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
                <button
                  onClick={() => toggleContentType(type)}
                  className="flex w-full items-center gap-3 p-4"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? "bg-emerald-100" : "bg-slate-100"}`}>
                    <Icon className={`h-4 w-4 ${selected ? "text-emerald-600" : "text-slate-400"}`} />
                  </div>
                  <span className={`text-sm font-medium ${selected ? "text-emerald-800" : "text-slate-700"}`}>{meta.label}</span>
                  <div className={`ml-auto h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}>
                    {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                </button>
                {selected && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    {type === "blog_post" && (
                      <label className="flex items-center justify-between text-sm text-slate-600">
                        <span>Blogginlägg per vecka</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPostsPerWeekBlog((v) => Math.max(1, v - 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">−</button>
                          <span className="w-6 text-center font-semibold text-slate-800">{postsPerWeekBlog}</span>
                          <button onClick={() => setPostsPerWeekBlog((v) => Math.min(7, v + 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">+</button>
                        </div>
                      </label>
                    )}
                    {type === "linkedin" && (
                      <label className="flex items-center justify-between text-sm text-slate-600">
                        <span>LinkedIn-inlägg per vecka</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPostsPerWeekLinkedin((v) => Math.max(1, v - 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">−</button>
                          <span className="w-6 text-center font-semibold text-slate-800">{postsPerWeekLinkedin}</span>
                          <button onClick={() => setPostsPerWeekLinkedin((v) => Math.min(7, v + 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">+</button>
                        </div>
                      </label>
                    )}
                    {type === "epost" && (
                      <label className="flex items-center justify-between text-sm text-slate-600">
                        <span>Nyhetsbrev per månad</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setNewslettersPerMonth((v) => Math.max(1, v - 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">−</button>
                          <span className="w-6 text-center font-semibold text-slate-800">{newslettersPerMonth}</span>
                          <button onClick={() => setNewslettersPerMonth((v) => Math.min(8, v + 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">+</button>
                        </div>
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {contentTypes.length === 0 && (
          <p className="mt-2 text-xs text-red-500">Välj minst en innehållstyp.</p>
        )}
      </section>

      {/* Step 3: Start date */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Startdatum för 90-dagarsplanen</h2>
        <p className="text-sm text-slate-500 mb-4">Planen sträcker sig 90 dagar framåt från detta datum.</p>
        <input
          type="date"
          value={planStartDate}
          onChange={(e) => setPlanStartDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </section>

      {/* Step 4: Team assignment */}
      {teamMembers.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Vilka ska skapa innehållet?</h2>
          <p className="text-sm text-slate-500 mb-4">Välj teammedlemmar som ska tilldelas inlägg i planen.</p>
          <div className="flex flex-wrap gap-2">
            {teamMembers.map((m) => {
              const sel = assignedMembers.includes(m);
              return (
                <button
                  key={m}
                  onClick={() => toggleMember(m)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    sel
                      ? "border-violet-400 bg-violet-100 text-violet-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  {m}
                </button>
              );
            })}
          </div>
          {assignedMembers.length === 0 && (
            <p className="mt-2 text-xs text-slate-400">Välj ingen för att hoppa över tilldelning.</p>
          )}
        </section>
      )}

      {/* Step 5: Site audit findings */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">Tekniska förbättringar från Site Audit</h2>
            <p className="text-sm text-slate-500">
              {auditLoading
                ? "Hämtar senaste audit…"
                : auditFindings.length === 0
                ? "Inga audit-fynd hittades. Kör en site audit under Insikter."
                : `${criticalCount} kritiska · ${warningCount} varningar hittades`}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-slate-600">Inkludera i planen</span>
            <button
              role="switch"
              aria-checked={includeAudit}
              onClick={() => setIncludeAudit((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors ${includeAudit ? "bg-emerald-500" : "bg-slate-200"}`}
            >
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${includeAudit ? "translate-x-5" : ""}`} />
            </button>
          </label>
        </div>

        {auditFindings.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setAuditExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              {auditExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {auditExpanded ? "Dölj fynd" : "Visa fynd"}
            </button>
            {auditExpanded && (
              <div className="mt-3 space-y-1.5">
                {auditFindings.slice(0, 10).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${f.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                    <span className="text-xs text-slate-700">{f.title}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${f.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {f.severity === "critical" ? "Kritisk" : "Varning"}
                    </span>
                  </div>
                ))}
                {auditFindings.length > 10 && (
                  <p className="text-xs text-slate-400 pl-1">+ {auditFindings.length - 10} fler fynd</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={contentTypes.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
        >
          <Target className="h-4 w-4" />
          Generera 90-dagarsplan
        </button>
      </div>
    </div>
  );
}
