/**
 * Circular score gauge (0–100). Pure SVG — no chart library needed.
 *
 * Tone follows score:
 *   ≥80 emerald (good)
 *   ≥50 amber   (warning)
 *   <50 rose    (poor)
 */

interface GaugeProps {
  score: number;
  label: string;
  description?: string;
  size?: "sm" | "md" | "lg";
}

const TONE = {
  emerald: { stroke: "#10b981", text: "text-emerald-700", track: "#d1fae5" },
  amber:   { stroke: "#f59e0b", text: "text-amber-700",   track: "#fef3c7" },
  rose:    { stroke: "#f43f5e", text: "text-rose-700",    track: "#ffe4e6" },
} as const;

function toneFor(score: number): keyof typeof TONE {
  if (score >= 80) return "emerald";
  if (score >= 50) return "amber";
  return "rose";
}

export default function Gauge({ score, label, description, size = "md" }: GaugeProps) {
  const dim = size === "lg" ? 160 : size === "sm" ? 96 : 128;
  const stroke = size === "lg" ? 12 : size === "sm" ? 8 : 10;
  const fontSize = size === "lg" ? "2rem" : size === "sm" ? "1.125rem" : "1.5rem";

  const radius = (dim - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const dash = (clamped / 100) * circ;

  const t = TONE[toneFor(clamped)];

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="-rotate-90"
        >
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={t.track}
            strokeWidth={stroke}
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={t.stroke}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: "stroke-dasharray 0.6s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold ${t.text}`} style={{ fontSize }}>
            {clamped}
          </span>
          {size !== "sm" && (
            <span className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">
              / 100
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 text-sm font-medium text-slate-800">{label}</div>
      {description && (
        <div className="mt-1 text-[11px] leading-snug text-slate-500 max-w-[180px]">
          {description}
        </div>
      )}
    </div>
  );
}
