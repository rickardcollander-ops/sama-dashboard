import type { ReactNode } from "react";

// Sprint 2 (X3) — shared page header so every customer-portal page has a
// consistent H1 + one-liner context + optional toolbar (period selector,
// refresh, primary CTA). Subtitle should answer "what is this page for?"
// in plain language — no jargon, no acronyms without expansion.

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  // Right-aligned toolbar (buttons, period selector, etc.)
  actions?: ReactNode;
  // Optional small status string under the subtitle, e.g. "Uppdaterad 2 min sen"
  meta?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  meta,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`mb-6 flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        )}
        {meta && <p className="mt-1 text-xs text-slate-400">{meta}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
