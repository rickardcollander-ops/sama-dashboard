"use client";

export type Period = "7d" | "30d" | "90d";

export const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const options: { key: Period; label: string }[] = [
    { key: "7d", label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
  ];

  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.key
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
