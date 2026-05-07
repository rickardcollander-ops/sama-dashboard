"use client";

import { useState } from "react";
import {
  Target, TrendingUp, Users, FileText, Linkedin, Mail,
  AlertTriangle, ChevronDown, ChevronUp, CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/lib/hooks/useLanguage";

export type PrimaryGoalValue = "traffic" | "brand" | "leads" | "seo" | "social" | "custom";

export interface StrategyGoals {
  primary_goals: PrimaryGoalValue[];
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

const PRIMARY_GOALS: { value: PrimaryGoalValue; icon: typeof TrendingUp }[] = [
  { value: "traffic", icon: TrendingUp },
  { value: "leads", icon: Target },
  { value: "brand", icon: CheckCircle2 },
  { value: "seo", icon: TrendingUp },
  { value: "social", icon: Users },
  { value: "custom", icon: Target },
];

const CONTENT_TYPE_META = {
  blog_post: { icon: FileText, color: "blue" },
  linkedin: { icon: Linkedin, color: "indigo" },
  epost: { icon: Mail, color: "amber" },
} as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function StrategyGoalsForm({ initialGoals, teamMembers, auditFindings, auditLoading, onSubmit }: Props) {
  const { t } = useLanguage();
  const [primaryGoals, setPrimaryGoals] = useState<PrimaryGoalValue[]>(initialGoals?.primary_goals ?? ["traffic"]);
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

  const goalMeta: Record<PrimaryGoalValue, { label: string; desc: string }> = {
    traffic: { label: t.strategyGoalsForm.goalTrafficLabel, desc: t.strategyGoalsForm.goalTrafficDesc },
    leads: { label: t.strategyGoalsForm.goalLeadsLabel, desc: t.strategyGoalsForm.goalLeadsDesc },
    brand: { label: t.strategyGoalsForm.goalBrandLabel, desc: t.strategyGoalsForm.goalBrandDesc },
    seo: { label: t.strategyGoalsForm.goalSeoLabel, desc: t.strategyGoalsForm.goalSeoDesc },
    social: { label: t.strategyGoalsForm.goalSocialLabel, desc: t.strategyGoalsForm.goalSocialDesc },
    custom: { label: t.strategyGoalsForm.goalCustomLabel, desc: t.strategyGoalsForm.goalCustomDesc },
  };

  const contentTypeLabels: Record<StrategyGoals["content_types"][number], string> = {
    blog_post: t.strategyGoalsForm.typeBlogLabel,
    linkedin: t.strategyGoalsForm.typeLinkedinLabel,
    epost: t.strategyGoalsForm.typeEmailLabel,
  };

  const toggleContentType = (ct: StrategyGoals["content_types"][number]) => {
    setContentTypes((prev) =>
      prev.includes(ct) ? prev.filter((x) => x !== ct) : [...prev, ct]
    );
  };

  const toggleMember = (m: string) => {
    setAssignedMembers((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const toggleGoal = (value: PrimaryGoalValue) => {
    setPrimaryGoals((prev) => {
      if (prev.includes(value)) {
        return prev.length > 1 ? prev.filter((g) => g !== value) : prev;
      }
      if (prev.length >= 2) return [prev[1], value];
      return [...prev, value];
    });
  };

  const criticalCount = auditFindings.filter((f) => f.severity === "critical").length;
  const warningCount = auditFindings.filter((f) => f.severity === "warning").length;

  const handleSubmit = () => {
    if (primaryGoals.length === 0 || contentTypes.length === 0) return;
    onSubmit({
      primary_goals: primaryGoals,
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
        <h2 className="text-base font-semibold text-slate-900 mb-1">{t.strategyGoalsForm.goalsTitle}</h2>
        <p className="text-sm text-slate-500 mb-4">{t.strategyGoalsForm.goalsHint}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PRIMARY_GOALS.map(({ value, icon: Icon }) => {
            const selected = primaryGoals.includes(value);
            const meta = goalMeta[value];
            return (
              <button
                key={value}
                onClick={() => toggleGoal(value)}
                className={`relative flex flex-col gap-1 rounded-lg border-2 p-3 text-left transition-all ${
                  selected
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {selected && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    {primaryGoals.indexOf(value) + 1}
                  </span>
                )}
                <div className="flex items-center gap-2 pr-6">
                  <Icon className={`h-4 w-4 flex-shrink-0 ${selected ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className={`text-sm font-medium ${selected ? "text-emerald-700" : "text-slate-700"}`}>{meta.label}</span>
                </div>
                <p className="text-xs text-slate-500 leading-snug">{meta.desc}</p>
              </button>
            );
          })}
        </div>
        {primaryGoals.length === 0 && (
          <p className="mt-2 text-xs text-red-500">{t.strategyGoalsForm.noGoalError}</p>
        )}
        {primaryGoals.includes("custom") && (
          <textarea
            value={customGoalText}
            onChange={(e) => setCustomGoalText(e.target.value)}
            placeholder={t.strategyGoalsForm.customGoalPlaceholder}
            rows={2}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        )}
      </section>

      {/* Step 2: Content types & volume */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-1">{t.strategyGoalsForm.contentTitle}</h2>
        <p className="text-sm text-slate-500 mb-4">{t.strategyGoalsForm.contentHint}</p>
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
                  <span className={`text-sm font-medium ${selected ? "text-emerald-800" : "text-slate-700"}`}>{contentTypeLabels[type]}</span>
                  <div className={`ml-auto h-5 w-5 rounded-full border-2 flex items-center justify-center ${selected ? "border-emerald-500 bg-emerald-500" : "border-slate-300"}`}>
                    {selected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                </button>
                {selected && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    {type === "blog_post" && (
                      <label className="flex items-center justify-between text-sm text-slate-600">
                        <span>{t.strategyGoalsForm.blogPerWeek}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPostsPerWeekBlog((v) => Math.max(1, v - 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">−</button>
                          <span className="w-6 text-center font-semibold text-slate-800">{postsPerWeekBlog}</span>
                          <button onClick={() => setPostsPerWeekBlog((v) => Math.min(7, v + 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">+</button>
                        </div>
                      </label>
                    )}
                    {type === "linkedin" && (
                      <label className="flex items-center justify-between text-sm text-slate-600">
                        <span>{t.strategyGoalsForm.linkedinPerWeek}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPostsPerWeekLinkedin((v) => Math.max(1, v - 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">−</button>
                          <span className="w-6 text-center font-semibold text-slate-800">{postsPerWeekLinkedin}</span>
                          <button onClick={() => setPostsPerWeekLinkedin((v) => Math.min(7, v + 1))} className="h-7 w-7 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base">+</button>
                        </div>
                      </label>
                    )}
                    {type === "epost" && (
                      <label className="flex items-center justify-between text-sm text-slate-600">
                        <span>{t.strategyGoalsForm.newslettersPerMonth}</span>
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
          <p className="mt-2 text-xs text-red-500">{t.strategyGoalsForm.noContentError}</p>
        )}
      </section>

      {/* Step 3: Start date */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-1">{t.strategyGoalsForm.startDateTitle}</h2>
        <p className="text-sm text-slate-500 mb-4">{t.strategyGoalsForm.startDateHint}</p>
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
          <h2 className="text-base font-semibold text-slate-900 mb-1">{t.strategyGoalsForm.teamTitle}</h2>
          <p className="text-sm text-slate-500 mb-4">{t.strategyGoalsForm.teamHint}</p>
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
            <p className="mt-2 text-xs text-slate-400">{t.strategyGoalsForm.noTeamSelection}</p>
          )}
        </section>
      )}

      {/* Step 5: Site audit findings */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">{t.strategyGoalsForm.auditTitle}</h2>
            <p className="text-sm text-slate-500">
              {auditLoading
                ? t.strategyGoalsForm.auditLoading
                : auditFindings.length === 0
                ? t.strategyGoalsForm.auditNone
                : `${criticalCount} ${t.strategyGoalsForm.auditFindings} · ${warningCount} ${t.strategyGoalsForm.auditFindingsWarnings}`}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-sm text-slate-600">{t.strategyGoalsForm.auditInclude}</span>
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
              {auditExpanded ? t.strategyGoalsForm.auditHideFindings : t.strategyGoalsForm.auditShowFindings}
            </button>
            {auditExpanded && (
              <div className="mt-3 space-y-1.5">
                {auditFindings.slice(0, 10).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${f.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                    <span className="text-xs text-slate-700">{f.title}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${f.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {f.severity === "critical" ? t.strategyGoalsForm.severityCritical : t.strategyGoalsForm.severityWarning}
                    </span>
                  </div>
                ))}
                {auditFindings.length > 10 && (
                  <p className="text-xs text-slate-400 pl-1">+ {auditFindings.length - 10} {t.strategyGoalsForm.auditMore}</p>
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
          disabled={primaryGoals.length === 0 || contentTypes.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
        >
          <Target className="h-4 w-4" />
          {t.strategyGoalsForm.generateBtn}
        </button>
      </div>
    </div>
  );
}
