"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar as CalendarIcon, Loader2, X } from "lucide-react";
import type { PlanItem } from "./ContentPlanTab";

// Default per-content-type slots used when computing the smart-distribution
// dates. weekday: 0=Sun … 6=Sat
const SLOTS_PER_TYPE: Record<string, { weekday: number; hour: number }> = {
  blog_article:  { weekday: 3, hour: 9 },
  blog_post:     { weekday: 3, hour: 9 },
  comparison:    { weekday: 3, hour: 14 },
  linkedin_post: { weekday: 2, hour: 9 },
  email:         { weekday: 4, hour: 8 },
};

const CADENCE_PRESETS: { label: string; count: number; interval_days: number }[] = [
  { label: "Once",          count: 1, interval_days: 0 },
  { label: "Weekly × 4",    count: 4, interval_days: 7 },
  { label: "Bi-weekly × 4", count: 4, interval_days: 14 },
  { label: "Daily × 5",     count: 5, interval_days: 1 },
];

interface RowState {
  selected: boolean;
  scheduled_for: string;       // datetime-local input value
  cadence_idx: number;          // index into CADENCE_PRESETS, -1 = custom
  custom_count: number;
  custom_interval: number;
}

const DEFAULT_ROW: RowState = {
  selected: false,
  scheduled_for: "",
  cadence_idx: 0,
  custom_count: 4,
  custom_interval: 7,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextSlot(after: Date, type: string, occupied: Set<string>): Date {
  const slot = SLOTS_PER_TYPE[type] || SLOTS_PER_TYPE.blog_article;
  for (let i = 0; i < 90; i++) {
    const d = new Date(after);
    d.setDate(after.getDate() + i);
    if (d.getDay() !== slot.weekday) continue;
    d.setHours(slot.hour, 0, 0, 0);
    if (d.getTime() < after.getTime()) continue;
    const key = `${type}|${d.toISOString().slice(0, 10)}`;
    if (occupied.has(key)) continue;
    occupied.add(key);
    return d;
  }
  const fb = new Date(after);
  fb.setDate(fb.getDate() + 7);
  fb.setHours(slot.hour, 0, 0, 0);
  return fb;
}

interface Props {
  apiBase: string;
  items: PlanItem[];
  onClose: () => void;
  onScheduled: () => void;
}

export default function PlanOutModal({ apiBase, items, onClose, onScheduled }: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [autoPublish, setAutoPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return toLocalInput(t);
  });

  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const out: Record<string, RowState> = {};
    for (const item of items) out[item.id] = { ...DEFAULT_ROW };
    return out;
  });

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => (i.source || "manual") === filter);
  }, [items, filter]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.source || "manual");
    return Array.from(set);
  }, [items]);

  // Recompute proposed dates whenever the selection or start-date changes.
  useEffect(() => {
    const occupied = new Set<string>();
    const start = new Date(startDate);
    setRows((prev) => {
      const next = { ...prev };
      // walk items in display order to keep distribution stable
      for (const item of items) {
        const r = next[item.id] || { ...DEFAULT_ROW };
        if (r.selected) {
          const dt = nextSlot(start, item.content_type, occupied);
          next[item.id] = { ...r, scheduled_for: toLocalInput(dt) };
        } else {
          next[item.id] = r;
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, JSON.stringify(items.map((i) => `${i.id}:${rows[i.id]?.selected ? 1 : 0}`))]);

  const toggle = (id: string) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || DEFAULT_ROW), selected: !(prev[id]?.selected) },
    }));
  };

  const selectAllVisible = () => {
    setRows((prev) => {
      const next = { ...prev };
      for (const item of filtered) {
        next[item.id] = { ...(next[item.id] || DEFAULT_ROW), selected: true };
      }
      return next;
    });
  };

  const clearAll = () => {
    setRows((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        next[id] = { ...next[id], selected: false };
      }
      return next;
    });
  };

  const selectedCount = (Object.values(rows) as RowState[]).filter((r) => r.selected).length;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const entries: Array<{ item_id: string; scheduled_for: string; auto_publish_on_schedule: boolean }> = [];
      const repeats: Record<string, { count: number; interval_days: number }> = {};
      for (const item of items) {
        const row = rows[item.id];
        if (!row?.selected || !row.scheduled_for) continue;
        entries.push({
          item_id: item.id,
          scheduled_for: new Date(row.scheduled_for).toISOString(),
          auto_publish_on_schedule: autoPublish,
        });
        const preset = row.cadence_idx >= 0 ? CADENCE_PRESETS[row.cadence_idx] : null;
        const count = preset ? preset.count : row.custom_count;
        const interval = preset ? preset.interval_days : row.custom_interval;
        if (count > 1 && interval > 0) {
          repeats[item.id] = { count, interval_days: interval };
        }
      }
      if (entries.length === 0) {
        setError("Pick at least one idea.");
        setSubmitting(false);
        return;
      }
      const res = await fetch(`${apiBase}/api/content/plan/bulk-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          repeats: Object.keys(repeats).length ? repeats : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onScheduled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex w-full max-w-4xl max-h-[90vh] flex-col rounded-2xl border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <CalendarIcon className="h-5 w-5 text-blue-500" /> Plan out content
            </h3>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                label={`All (${items.length})`}
                active={filter === "all"}
                onClick={() => { setFilter("all"); }}
              />
              {sources.map((s) => (
                <FilterChip
                  key={s}
                  label={`${s.replace(/_/g, " ")} (${items.filter((i) => (i.source || "manual") === s).length})`}
                  active={filter === s}
                  onClick={() => { setFilter(s); }}
                />
              ))}
              <div className="ml-auto flex gap-2 text-xs">
                <button onClick={selectAllVisible} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50">
                  Select all
                </button>
                <button onClick={clearAll} className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50">
                  Clear
                </button>
              </div>
            </div>

            <div className="rounded-lg border divide-y">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  No unscheduled ideas in this filter.
                </div>
              ) : (
                filtered.map((item) => {
                  const row = rows[item.id] || DEFAULT_ROW;
                  return (
                    <div key={item.id} className="grid gap-3 p-3 sm:grid-cols-[auto_1fr_auto_auto]">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggle(item.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{item.title}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-slate-500">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">
                            {item.content_type.replace(/_/g, " ")}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5">
                            {(item.source || "manual").replace(/_/g, " ")}
                          </span>
                          {item.target_keyword && <span>kw: {item.target_keyword}</span>}
                        </div>
                      </div>
                      <input
                        type="datetime-local"
                        value={row.scheduled_for}
                        disabled={!row.selected}
                        onChange={(e) =>
                          setRows((prev) => ({
                            ...prev,
                            [item.id]: { ...(prev[item.id] || DEFAULT_ROW), scheduled_for: e.target.value },
                          }))
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                      />
                      <div className="flex items-center gap-1">
                        <select
                          disabled={!row.selected}
                          value={row.cadence_idx}
                          onChange={(e) =>
                            setRows((prev) => ({
                              ...prev,
                              [item.id]: { ...(prev[item.id] || DEFAULT_ROW), cadence_idx: Number(e.target.value) },
                            }))
                          }
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          {CADENCE_PRESETS.map((p, i) => (
                            <option key={i} value={i}>{p.label}</option>
                          ))}
                          <option value={-1}>Custom…</option>
                        </select>
                        {row.cadence_idx === -1 && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <input
                              type="number"
                              min={1}
                              value={row.custom_count}
                              onChange={(e) =>
                                setRows((prev) => ({
                                  ...prev,
                                  [item.id]: { ...(prev[item.id] || DEFAULT_ROW), custom_count: Number(e.target.value) },
                                }))
                              }
                              className="w-12 rounded-md border border-slate-300 px-1 py-0.5"
                            />
                            ×
                            <input
                              type="number"
                              min={1}
                              value={row.custom_interval}
                              onChange={(e) =>
                                setRows((prev) => ({
                                  ...prev,
                                  [item.id]: { ...(prev[item.id] || DEFAULT_ROW), custom_interval: Number(e.target.value) },
                                }))
                              }
                              className="w-12 rounded-md border border-slate-300 px-1 py-0.5"
                            />
                            d
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3">
            <div className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                Start from
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={autoPublish}
                  onChange={(e) => setAutoPublish(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Auto-publish on schedule
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={selectedCount === 0 || submitting}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-400"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarIcon className="h-4 w-4" />}
                Schedule {selectedCount > 0 && `${selectedCount} item${selectedCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const FilterChip: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`rounded-full px-3 py-1 text-xs font-medium ${
      active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`}
  >
    {label}
  </button>
);
