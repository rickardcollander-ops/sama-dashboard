"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";

export interface TrafficGraphLine {
  key: string;
  label: string;
  color: string;
}

export interface TrafficGraphProps {
  title: string;
  subtitle: string;
  data?: { date: string; clicks: number; impressions: number }[];
  projectStartDate: string | null;
  visible: boolean;
  onToggle: () => void;
  lines: TrafficGraphLine[];
  noData: string;
  noDataDesc: string;
  noDataHref?: string;
  chartStart: string;
}

export default function TrafficGraph({
  title, subtitle, data, projectStartDate, visible, onToggle, lines, noData, noDataDesc, noDataHref, chartStart,
}: TrafficGraphProps) {
  const hasData = data && data.length > 0;

  const fmtDate = (v: unknown): string => {
    const d = new Date(String(v ?? ""));
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <div className="text-left">
            <div className="font-semibold text-slate-900 text-sm">{title}</div>
            <div className="text-xs text-slate-500">{subtitle}</div>
          </div>
        </div>
        {visible ? (
          <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {visible && (
        <div className="px-6 pb-6">
          {hasData ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={fmtDate} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} width={40} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }}
                    labelFormatter={fmtDate}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                  {lines.map((l) => (
                    <Line key={l.key} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  ))}
                  {projectStartDate && (
                    <ReferenceLine
                      x={projectStartDate}
                      stroke="#f59e0b"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      label={{ value: chartStart, position: "insideTopRight", fontSize: 11, fill: "#f59e0b", fontWeight: 600 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <TrendingUp className="h-8 w-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">{noData}</p>
              {noDataHref ? (
                <Link href={noDataHref} className="text-xs text-blue-500 hover:underline mt-1">{noDataDesc}</Link>
              ) : (
                <p className="text-xs text-slate-300 mt-1">{noDataDesc}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
