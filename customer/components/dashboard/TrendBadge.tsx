"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface TrendBadgeProps {
  /** Numeric delta — positive = up, negative = down, 0 = flat */
  delta: number | null | undefined;
  /** If true, lower is better (e.g. SEO rank). Default: higher is better. */
  inverted?: boolean;
  /** Format delta as percent with + prefix */
  format?: "percent" | "number" | "rank";
  className?: string;
}

export default function TrendBadge({
  delta,
  inverted = false,
  format = "percent",
  className = "",
}: TrendBadgeProps) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs text-slate-400 ${className}`}>
        <Minus className="h-3 w-3" /> —
      </span>
    );
  }

  const isFlat = Math.abs(delta) < 0.005;
  const isPositive = inverted ? delta < 0 : delta > 0;
  const color = isFlat
    ? "text-slate-400"
    : isPositive
    ? "text-emerald-600"
    : "text-red-500";
  const Icon = isFlat ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  const formatted =
    format === "percent"
      ? `${delta > 0 ? "+" : ""}${(delta * 100).toFixed(0)}%`
      : format === "rank"
      ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`
      : `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color} ${className}`}>
      <Icon className="h-3 w-3" />
      {isFlat ? "0%" : formatted}
    </span>
  );
}
