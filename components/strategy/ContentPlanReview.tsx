"use client";

import { useState } from "react";
import {
  FileText, Linkedin, Mail, Users, Calendar, Trash2,
  Plus, CheckCircle, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { useLanguage } from "@/lib/hooks/useLanguage";
import type { StrategyGoals } from "./StrategyGoalsForm";

export interface ContentPlanItem {
  id: string;
  title: string;
  content_type: "blog_post" | "linkedin" | "epost";
  scheduled_date: string;
  assigned_to: string;
  source_strategy_topic?: string;
}

interface Strategy {
  roadmap?: Array<{ horizon: string; title?: string; items?: string[] }>;
  cross_channel_priorities?: Array<{ title: string; description?: string }>;
  domain_strategies?: Array<{ domain: string; key_actions?: string[] }>;
}

interface Props {
  goals: StrategyGoals;
  strategy: Strategy;
  onApprove: (items: ContentPlanItem[]) => Promise<void>;
  onBack: () => void;
}

const TYPE_META = {
  blog_post: { icon: FileText, bg: "bg-blue-100", text: "text-blue-700" },
  linkedin: { icon: Linkedin, bg: "bg-indigo-100", text: "text-indigo-700" },
  epost: { icon: Mail, bg: "bg-amber-100", text: "text-amber-700" },
} as const;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(isoMonth: string): string {
  const d = new Date(isoMonth + "-01");
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function buildPlan(goals: StrategyGoals, strategy: Strategy): ContentPlanItem[] {
  const start = new Date(goals.plan_start_date);

  const topics: string[] = [];
  for (const p of strategy.cross_channel_priorities ?? []) {
    if (p.title) topics.push(p.title);
  }
  for (const m of strategy.roadmap ?? []) {
    for (const item of m.items ?? []) {
      topics.push(item);
    }
  }
  for (const d of strategy.domain_strategies ?? []) {
    for (const a of d.key_actions ?? []) {
      topics.push(a);
    }
  }

  const items: ContentPlanItem[] = [];
  const weeks = 13;

  if (goals.content_types.includes("blog_post") && goals.posts_per_week_blog > 0) {
    const total = goals.posts_per_week_blog * weeks;
    for (let i = 0; i < total; i++) {
      const weekIndex = Math.floor(i / goals.posts_per_week_blog);
      const dayOffset = weekIndex * 7 + (i % goals.posts_per_week_blog) * Math.floor(7 / goals.posts_per_week_blog);
      const topic = topics[i % topics.length] || `Blog post ${i + 1}`;
      items.push({
        id: uid(),
        title: topic.length > 80 ? topic.slice(0, 77) + "…" : topic,
        content_type: "blog_post",
        scheduled_date: formatDate(addDays(start, Math.min(dayOffset, 89))),
        assigned_to: goals.assigned_members.length > 0
          ? goals.assigned_members[i % goals.assigned_members.length]
          : "",
        source_strategy_topic: topic,
      });
    }
  }

  if (goals.content_types.includes("linkedin") && goals.posts_per_week_linkedin > 0) {
    const total = goals.posts_per_week_linkedin * weeks;
    const topicOffset = items.length;
    for (let i = 0; i < total; i++) {
      const weekIndex = Math.floor(i / goals.posts_per_week_linkedin);
      const dayOffset = weekIndex * 7 + (i % goals.posts_per_week_linkedin) * Math.floor(7 / goals.posts_per_week_linkedin) + 1;
      const topic = topics[(topicOffset + i) % (topics.length || 1)] || `LinkedIn post ${i + 1}`;
      items.push({
        id: uid(),
        title: topic.length > 80 ? topic.slice(0, 77) + "…" : topic,
        content_type: "linkedin",
        scheduled_date: formatDate(addDays(start, Math.min(dayOffset, 89))),
        assigned_to: goals.assigned_members.length > 0
          ? goals.assigned_members[(topicOffset + i) % goals.assigned_members.length]
          : "",
        source_strategy_topic: topic,
      });
    }
  }

  if (goals.content_types.includes("epost") && goals.newsletters_per_month > 0) {
    const total = goals.newsletters_per_month * 3;
    const topicOffset = items.length;
    for (let i = 0; i < total; i++) {
      const dayOffset = Math.round((i / (total - 1 || 1)) * 89);
      const topic = topics[(topicOffset + i) % (topics.length || 1)] || `Nyhetsbrev ${i + 1}`;
      items.push({
        id: uid(),
        title: topic.length > 80 ? topic.slice(0, 77) + "…" : topic,
        content_type: "epost",
        scheduled_date: formatDate(addDays(start, dayOffset)),
        assigned_to: goals.assigned_members.length > 0
          ? goals.assigned_members[(topicOffset + i) % goals.assigned_members.length]
          : "",
        source_strategy_topic: topic,
      });
    }
  }

  return items.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
}

export default function ContentPlanReview({ goals, strategy, onApprove, onBack }: Props) {
  const { t } = useLanguage();
  const [items, setItems] = useState<ContentPlanItem[]>(() => buildPlan(goals, strategy));
  const [approving, setApproving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const TYPE_LABELS: Record<string, string> = {
    blog_post: t.contentPlanReview.typeBlog,
    linkedin: t.contentPlanReview.typeLinkedin,
    epost: t.contentPlanReview.typeEmail,
  };

  const blogCount = items.filter((i) => i.content_type === "blog_post").length;
  const linkedinCount = items.filter((i) => i.content_type === "linkedin").length;
  const emailCount = items.filter((i) => i.content_type === "epost").length;

  const updateItem = (id: string, patch: Partial<ContentPlanItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = (type: ContentPlanItem["content_type"]) => {
    const newItem: ContentPlanItem = {
      id: uid(),
      title: "",
      content_type: type,
      scheduled_date: goals.plan_start_date,
      assigned_to: goals.assigned_members[0] ?? "",
    };
    setItems((prev) => [...prev, newItem].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)));
    setEditingId(newItem.id);
  };

  const handleApprove = async () => {
    const valid = items.filter((i) => i.title.trim());
    setApproving(true);
    await onApprove(valid);
    setApproving(false);
  };

  const byMonth: Record<string, ContentPlanItem[]> = {};
  for (const item of items) {
    const key = item.scheduled_date.slice(0, 7);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(item);
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="text-base font-semibold text-emerald-900 mb-3">{t.contentPlanReview.summaryTitle}</h2>
        <div className="flex flex-wrap gap-4">
          {blogCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-blue-100">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">{blogCount}</span>
              <span className="text-sm text-slate-600">{t.contentPlanReview.blogPosts}</span>
            </div>
          )}
          {linkedinCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-indigo-100">
              <Linkedin className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-700">{linkedinCount}</span>
              <span className="text-sm text-slate-600">{t.contentPlanReview.linkedinPosts}</span>
            </div>
          )}
          {emailCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-amber-100">
              <Mail className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">{emailCount}</span>
              <span className="text-sm text-slate-600">{t.contentPlanReview.newsletters}</span>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-sm border border-slate-100">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-600">{t.contentPlanReview.totalPosts} {items.length} {t.contentPlanReview.posts}</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-emerald-700">{t.contentPlanReview.reviewHint}</p>
      </section>

      {/* Items grouped by month */}
      {Object.entries(byMonth).map(([month, monthItems]) => {
        const label = formatMonthLabel(month);
        const isCollapsed = collapsed[month];
        return (
          <section key={month} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [month]: !c[month] }))}
              className="flex w-full items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-800 capitalize">{label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{monthItems.length} {t.contentPlanReview.posts}</span>
                {isCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
              </div>
            </button>
            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {monthItems.map((item) => {
                  const meta = TYPE_META[item.content_type];
                  const Icon = meta.icon;
                  const isEditing = editingId === item.id;
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-5 py-3">
                      <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${meta.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={item.title}
                            onChange={(e) => updateItem(item.id, { title: e.target.value })}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                            className="w-full rounded border border-emerald-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingId(item.id)}
                            className="text-left text-sm text-slate-800 hover:text-emerald-700 w-full truncate"
                          >
                            {item.title || <span className="italic text-slate-400">{t.contentPlanReview.titlePlaceholder}</span>}
                          </button>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className={`rounded-full px-2 py-0.5 font-medium ${meta.bg} ${meta.text}`}>{TYPE_LABELS[item.content_type]}</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <input
                              type="date"
                              value={item.scheduled_date}
                              onChange={(e) => updateItem(item.id, { scheduled_date: e.target.value })}
                              className="border-0 bg-transparent text-xs text-slate-500 focus:outline-none focus:ring-0 cursor-pointer"
                            />
                          </div>
                          {item.assigned_to && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{item.assigned_to}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="mt-1 flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      {/* Add buttons */}
      <div className="flex flex-wrap gap-2">
        {goals.content_types.includes("blog_post") && (
          <button onClick={() => addItem("blog_post")} className="flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
            <Plus className="h-3.5 w-3.5" /> {t.contentPlanReview.addBlog}
          </button>
        )}
        {goals.content_types.includes("linkedin") && (
          <button onClick={() => addItem("linkedin")} className="flex items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
            <Plus className="h-3.5 w-3.5" /> {t.contentPlanReview.addLinkedin}
          </button>
        )}
        {goals.content_types.includes("epost") && (
          <button onClick={() => addItem("epost")} className="flex items-center gap-1.5 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors">
            <Plus className="h-3.5 w-3.5" /> {t.contentPlanReview.addNewsletter}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={approving}
          className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline disabled:opacity-50"
        >
          {t.contentPlanReview.back}
        </button>
        <button
          onClick={handleApprove}
          disabled={approving || items.filter((i) => i.title.trim()).length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
        >
          {approving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          {approving ? t.contentPlanReview.approving : `${t.contentPlanReview.approve} ${items.filter((i) => i.title.trim()).length} ${t.contentPlanReview.approveUnit}`}
        </button>
      </div>
    </div>
  );
}
