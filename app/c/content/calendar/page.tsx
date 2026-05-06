"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar, ChevronLeft, ChevronRight, Loader2, Trash2,
  CheckCircle, AlertCircle, Clock, ExternalLink,
} from "lucide-react";
import CustomerNav from "@/components/CustomerNav";
import { CmsKind } from "@/lib/integrations/cms/types";
import { KIND_META } from "@/lib/integrations/cms";
import { useSite } from "@/lib/hooks/useSite";

interface ScheduledItem {
  id: string;
  piece_id: string;
  destination_id: string;
  scheduled_at: string;
  status: "scheduled" | "publishing" | "published" | "failed";
  published_url?: string;
  error?: string;
  payload?: { title?: string; slug?: string };
}

interface Destination {
  id: string;
  kind: CmsKind;
  name: string;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function ContentCalendarPage() {
  const { effectiveTenantId } = useSite();
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  const tenantHeaders = (): HeadersInit => ({ "X-Tenant-ID": effectiveTenantId });

  const load = async () => {
    setLoading(true);
    setScheduled([]);
    setDestinations([]);
    try {
      const [s, d] = await Promise.all([
        fetch("/api/integrations/scheduled", { headers: tenantHeaders() }).then((r) => r.json()),
        fetch("/api/integrations/destinations", { headers: tenantHeaders() }).then((r) => r.json()),
      ]);
      setScheduled(s.scheduled || []);
      setDestinations(d.destinations || []);
    } catch {
      setScheduled([]);
      setDestinations([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (effectiveTenantId) load();
  }, [effectiveTenantId]);

  const remove = async (id: string) => {
    if (!confirm("Avbryta planerad publicering?")) return;
    await fetch(`/api/integrations/scheduled?id=${id}`, { method: "DELETE", headers: tenantHeaders() });
    load();
  };

  // Sprint 4 (C2) — drag-and-drop. We persist the new scheduled_at via the
  // existing PATCH /api/integrations/scheduled endpoint and update locally.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const moveTo = async (id: string, target: Date) => {
    const current = scheduled.find((s) => s.id === id);
    if (!current) return;
    const prev = new Date(current.scheduled_at);
    if (isSameDay(prev, target)) return;
    const next = new Date(target);
    next.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
    const iso = next.toISOString();

    // Optimistic local update.
    setScheduled((prevList) =>
      prevList.map((s) => (s.id === id ? { ...s, scheduled_at: iso } : s)),
    );

    try {
      const res = await fetch("/api/integrations/scheduled", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...tenantHeaders() },
        body: JSON.stringify({ id, patch: { scheduled_at: iso } }),
      });
      if (!res.ok) throw new Error("patch failed");
    } catch {
      // Roll back on failure
      setScheduled((prevList) =>
        prevList.map((s) =>
          s.id === id ? { ...s, scheduled_at: current.scheduled_at } : s,
        ),
      );
      alert("Kunde inte flytta — försök igen");
    }
  };

  const destLabel = (id: string) => {
    if (!id) return "Planerad (inget CMS)";
    const d = destinations.find((x) => x.id === id);
    if (!d) return "Planerad (inget CMS)";
    return `${d.name} (${KIND_META[d.kind]?.label || d.kind})`;
  };

  const grid = useMemo(() => {
    const first = startOfMonth(month);
    const startDow = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const itemsForDay = (d: Date) =>
    scheduled.filter((s) => isSameDay(new Date(s.scheduled_at), d));

  const monthLabel = month.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/50">
      <CustomerNav />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Calendar className="h-7 w-7 text-blue-500" />
              Kalender
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Planerade och publicerade inlägg över alla anslutna CMS.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth(addMonths(month, -1))}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-slate-700">{monthLabel}</span>
            <button
              onClick={() => setMonth(addMonths(month, 1))}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {scheduled.some((s) => s.status === "scheduled" || s.status === "failed") && (
              <p className="mb-3 text-xs text-slate-400">
                Tips: dra och släpp en planerad publicering till en annan dag för att flytta den.
              </p>
            )}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="grid grid-cols-7 border-b bg-slate-50 text-xs font-medium text-slate-500">
                {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
                  <div key={d} className="px-2 py-2 text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {grid.map((d, i) => {
                  const items = d ? itemsForDay(d) : [];
                  const today = d && isSameDay(d, new Date());
                  const dayKey = d ? d.toISOString().slice(0, 10) : null;
                  const isHover = dayKey && hoverDay === dayKey;
                  return (
                    <div
                      key={i}
                      onDragOver={(e) => {
                        if (!d || !draggingId) return;
                        e.preventDefault();
                        if (dayKey && hoverDay !== dayKey) setHoverDay(dayKey);
                      }}
                      onDragLeave={() => {
                        if (dayKey && hoverDay === dayKey) setHoverDay(null);
                      }}
                      onDrop={(e) => {
                        if (!d || !draggingId) return;
                        e.preventDefault();
                        moveTo(draggingId, d);
                        setHoverDay(null);
                      }}
                      className={`min-h-[110px] border-b border-r border-slate-100 p-2 transition-colors ${
                        d ? "bg-white" : "bg-slate-50/40"
                      } ${today ? "ring-2 ring-blue-200 ring-inset" : ""} ${
                        isHover ? "bg-blue-50/60 ring-2 ring-blue-300 ring-inset" : ""
                      }`}
                    >
                      {d && (
                        <>
                          <div className={`text-xs font-medium ${today ? "text-blue-600" : "text-slate-500"}`}>
                            {d.getDate()}
                          </div>
                          <div className="mt-1 space-y-1">
                            {items.map((it) => {
                              const draggable = it.status === "scheduled" || it.status === "failed";
                              return (
                                <div
                                  key={it.id}
                                  draggable={draggable}
                                  onDragStart={() => draggable && setDraggingId(it.id)}
                                  onDragEnd={() => {
                                    setDraggingId(null);
                                    setHoverDay(null);
                                  }}
                                  className={`group flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] truncate ${
                                    it.status === "published" ? "bg-emerald-50 text-emerald-700" :
                                    it.status === "failed" ? "bg-red-50 text-red-700" :
                                    it.status === "publishing" ? "bg-amber-50 text-amber-700" :
                                    "bg-blue-50 text-blue-700"
                                  } ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${
                                    draggingId === it.id ? "opacity-50" : ""
                                  }`}
                                  title={
                                    draggable
                                      ? `${it.payload?.title || it.piece_id} — dra för att flytta`
                                      : it.payload?.title || it.piece_id
                                  }
                                >
                                  {it.status === "published" ? <CheckCircle className="h-2.5 w-2.5 flex-shrink-0" /> :
                                    it.status === "failed" ? <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" /> :
                                    <Clock className="h-2.5 w-2.5 flex-shrink-0" />}
                                  <span className="truncate">{it.payload?.title || "Planerad publicering"}</span>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Närmast och senast</h2>
              {scheduled.length === 0 ? (
                <div className="rounded-xl border bg-white p-10 text-center shadow-sm">
                  <Calendar className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">Inget planerat än.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Klicka Publicera på ett content-utkast och välj &ldquo;Schemalägg&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border bg-white shadow-sm divide-y">
                  {[...scheduled].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)).map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {it.payload?.title || "Utan titel"}
                          </span>
                          <StatusBadge status={it.status} />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {new Date(it.scheduled_at).toLocaleString()} · {destLabel(it.destination_id)}
                        </p>
                        {it.error && <p className="mt-0.5 text-xs text-red-600">{it.error}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        {it.published_url && (
                          <a
                            href={it.published_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            title="Öppna"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {it.status !== "published" && (
                          <button
                            onClick={() => remove(it.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Avbryt"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    scheduled: "bg-blue-50 text-blue-700",
    publishing: "bg-amber-50 text-amber-700",
    published: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    scheduled: "planerad",
    publishing: "publicerar",
    published: "publicerad",
    failed: "fel",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] || "bg-slate-100 text-slate-600"}`}>
      {labels[status] || status}
    </span>
  );
}
