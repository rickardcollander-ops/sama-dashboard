"use client";

import Link from "next/link";
import { Check, Circle, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/hooks/useLanguage";
import WeeklyRhythm from "./WeeklyRhythm";

export interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  done: boolean;
  href: string;
  cta?: string;
}

interface OnboardingChecklistProps {
  items: ChecklistItem[];
  onDismiss?: () => void;
  // Override the default "Kom igång med SAMA" header — used after the
  // wizard is finished to switch to a "Kvar att göra" integration list.
  title?: string;
  // When true, all-items-done does NOT collapse into the WeeklyRhythm
  // widget. Used by the post-onboarding integrations variant so it
  // disappears outright once every integration is connected (the
  // weekly rhythm is already rendered separately on that page).
  hideWhenAllDone?: boolean;
}

export default function OnboardingChecklist({
  items,
  onDismiss,
  title,
  hideWhenAllDone,
}: OnboardingChecklistProps) {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total && total > 0;
  const heading = title || t.onboarding.title;

  if (allDone) {
    // Render nothing when the caller takes responsibility for the
    // "everything is connected" state (e.g. the integrations checklist
    // post-onboarding).
    if (hideWhenAllDone) return null;
    // Otherwise surface the scheduled / autopilot rhythm so the user
    // knows the dashboard hasn't gone quiet, just shifted from "to do"
    // to "running".
    return <WeeklyRhythm />;
  }

  return (
    <div className="mb-8 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="#dbeafe" strokeWidth="4" />
              <circle
                cx="20" cy="20" r="16" fill="none" stroke="#3b82f6" strokeWidth="4"
                strokeDasharray={`${(percent / 100) * 100.53} 100.53`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-700">
              {percent}%
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900">{heading}</h3>
            <p className="text-xs text-blue-700">
              {done} {t.onboarding.progress} {total} {t.onboarding.progressSteps}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {collapsed ? t.onboarding.show : t.onboarding.hide}
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="rounded-lg p-1.5 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
              title={t.onboarding.dismiss}
              aria-label={t.onboarding.dismiss}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <ul className="divide-y divide-blue-100 border-t border-blue-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-6 py-3 hover:bg-blue-100/40 transition-colors"
              >
                {item.done ? (
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 flex-shrink-0 text-blue-300" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                    {item.label}
                  </p>
                  {item.description && !item.done && (
                    <p className="text-xs text-slate-500">{item.description}</p>
                  )}
                </div>
                {!item.done && (
                  <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                    {item.cta || t.onboarding.start}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
