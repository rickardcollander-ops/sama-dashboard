"use client";

interface Props {
  score: number;
  size?: number;
}

export default function ScoreGauge({ score, size = 120 }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const radius = (size - 16) / 2;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color =
    clamped >= 85 ? "#16a34a" :
    clamped >= 65 ? "#84cc16" :
    clamped >= 40 ? "#f59e0b" :
    "#ef4444";

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 16 }}>
      <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`}>
        <path
          d={`M 8 ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2 + 4}`}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d={`M 8 ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2 + 4}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease, stroke 600ms ease" }}
        />
      </svg>
      <div
        className="absolute inset-x-0 flex items-baseline justify-center gap-1 text-slate-900"
        style={{ top: size / 2 - 18 }}
      >
        <span className="text-3xl font-bold tabular-nums">{clamped}</span>
        <span className="text-xs text-slate-400">/100</span>
      </div>
    </div>
  );
}
