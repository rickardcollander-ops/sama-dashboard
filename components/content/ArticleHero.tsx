"use client";

import { Calendar, FileText, Search, Sparkles, Tag } from "lucide-react";

interface Props {
  title: string;
  date?: string | null;
  primaryKeyword?: string | null;
  wordCount?: number | null;
  score?: number | null;
  contentType?: string | null;
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
      {icon}
      {children}
    </span>
  );
}

function scoreToneClasses(score: number) {
  if (score >= 85) return "border-green-200 bg-green-50 text-green-700";
  if (score >= 65) return "border-lime-200 bg-lime-50 text-lime-700";
  if (score >= 40) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

export default function ArticleHero({
  title,
  date,
  primaryKeyword,
  wordCount,
  score,
  contentType,
}: Props) {
  return (
    <header className="mb-10">
      <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-5">
        {title}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {typeof score === "number" && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${scoreToneClasses(score)}`}
          >
            <Sparkles className="h-3 w-3" />
            Score {score}/100
          </span>
        )}
        {primaryKeyword && (
          <Chip icon={<Search className="h-3 w-3 text-slate-400" />}>{primaryKeyword}</Chip>
        )}
        {typeof wordCount === "number" && wordCount > 0 && (
          <Chip icon={<FileText className="h-3 w-3 text-slate-400" />}>
            {wordCount.toLocaleString()} words
          </Chip>
        )}
        {contentType && (
          <Chip icon={<Tag className="h-3 w-3 text-slate-400" />}>
            {contentType.replace(/_/g, " ")}
          </Chip>
        )}
        {date && (
          <Chip icon={<Calendar className="h-3 w-3 text-slate-400" />}>
            {new Date(date).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </Chip>
        )}
      </div>
    </header>
  );
}
