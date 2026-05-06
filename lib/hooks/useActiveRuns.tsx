"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { tenantApi } from "@/lib/api";
import { useUser } from "@/lib/hooks/useUser";

export type AgentKey = "ai_visibility" | "seo" | "analytics" | "ads" | "content" | "social" | "strategy" | "site_audit";

export interface ActiveRun {
  id: string;
  agent: AgentKey;
  label: string;
  triggered_at: number;
  expected_seconds: number;
  status: "pending" | "running" | "completed" | "failed";
  run_id?: string;
  summary?: string;
  error?: string;
  completed_at?: number;
  dismissed?: boolean;
  // Optional granular progress for agents that report it (currently
  // site_audit). When present, the banner shows "X av Y sidor" and the
  // progress bar uses the real ratio instead of a time-based estimate.
  pages_done?: number;
  pages_total?: number;
}

interface AgentRunRow {
  id: string;
  agent_name: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  summary: string | null;
  error?: string | null;
}

interface SiteAuditRunRow {
  id: string;
  status: string;
  pages_total?: number | null;
  pages_done?: number | null;
  pages_analyzed?: number | null;
  overall_score?: number | null;
  completed_at?: string | null;
  error?: string | null;
}

const AGENT_NAME_ALIASES: Record<AgentKey, string[]> = {
  ai_visibility: ["ai_visibility", "ai-visibility", "aivisibility", "geo", "geo_visibility", "ai_check"],
  seo: ["seo", "search_console", "gsc", "seo_check", "keyword"],
  analytics: ["analytics", "ga4", "google_analytics", "metrics"],
  ads: ["ads", "google_ads", "ad_performance"],
  content: ["content", "content_generation", "article"],
  social: ["social", "social_post"],
  strategy: ["strategy", "marketing_strategy", "strategi"],
  // Site audit doesn't write to agent_runs (it has its own table and is
  // polled separately), so the alias list is unused — declared for type
  // completeness only.
  site_audit: ["site_audit", "site-audit"],
};

function matchesAgent(backendName: string, agent: AgentKey): boolean {
  const lower = (backendName || "").toLowerCase();
  return AGENT_NAME_ALIASES[agent].some((alias) => lower.includes(alias));
}

export const AGENT_DEFAULTS: Record<AgentKey, { label: string; expected_seconds: number }> = {
  ai_visibility: { label: "AI Visibility (GEO)", expected_seconds: 300 },
  seo: { label: "SEO / Search Console", expected_seconds: 60 },
  analytics: { label: "Analytics", expected_seconds: 45 },
  ads: { label: "Google Ads", expected_seconds: 45 },
  content: { label: "Content generation", expected_seconds: 90 },
  social: { label: "Social", expected_seconds: 45 },
  strategy: { label: "Strategi-syntes", expected_seconds: 90 },
  // 200 pages × ~0.5 s/page (5-way concurrency) ≈ 60 s; bump headroom
  // for slow servers and link checking.
  site_audit: { label: "Sajtanalys", expected_seconds: 180 },
};

interface ActiveRunsContextValue {
  runs: ActiveRun[];
  triggerRun: (
    agent: AgentKey,
    endpoint: string,
    options?: { label?: string; body?: unknown },
  ) => Promise<string | undefined>;
  // Attach the widget to a run that the caller already POSTed (e.g. when the
  // page kicks off the audit alongside another request and just wants the
  // widget to track it). Idempotent on run_id within an agent kind.
  registerRun: (
    agent: AgentKey,
    runId: string,
    options?: { label?: string },
  ) => string | undefined;
  dismissRun: (id: string) => void;
  clearCompleted: () => void;
}

const ActiveRunsContext = createContext<ActiveRunsContextValue | null>(null);

const POLL_INTERVAL_MS = 12_000;
const COMPLETED_AUTO_DISMISS_MS = 60_000;
// If we never see a matching agent_runs row within this window, give up
// looking. The agent may still be running on backend — we just can't track
// it from here, so we surface a soft "status unknown" instead of a scary
// failure.
const TRACKING_TIMEOUT_MS = 5 * 60 * 1000;
// Absolute ceiling — even an actively-running agent gets cleared from
// localStorage after this so we don't carry yesterday's runs forever.
const HARD_TIMEOUT_MS = 30 * 60 * 1000;

const storageKey = (userId: string) => `sama-active-runs-${userId}`;

function loadFromStorage(userId: string): ActiveRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActiveRun[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => Date.now() - r.triggered_at < HARD_TIMEOUT_MS);
  } catch {
    return [];
  }
}

function saveToStorage(userId: string, runs: ActiveRun[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(runs));
  } catch {
    // quota / private mode — ignore
  }
}

export function ActiveRunsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [runs, setRuns] = useState<ActiveRun[]>([]);
  const runsRef = useRef<ActiveRun[]>([]);

  // Keep the ref in sync so the polling effect always sees the latest list
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  // Load from localStorage when user becomes available — one-time hydration
  // per user. The setState here is the React-recommended way to seed state
  // from a per-user external source where the key is only known after auth.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRuns(loadFromStorage(user.id));
  }, [user]);

  // Persist whenever runs change
  useEffect(() => {
    if (!user) return;
    saveToStorage(user.id, runs);
  }, [runs, user]);

  const updateRun = useCallback((id: string, patch: Partial<ActiveRun>) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const triggerRun = useCallback<ActiveRunsContextValue["triggerRun"]>(
    async (agent, endpoint, options) => {
      if (!user) return undefined;
      const id = `${agent}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const defaults = AGENT_DEFAULTS[agent];
      const newRun: ActiveRun = {
        id,
        agent,
        label: options?.label || defaults.label,
        triggered_at: Date.now(),
        expected_seconds: defaults.expected_seconds,
        status: "pending",
      };
      setRuns((prev) => [...prev.filter((r) => !(r.agent === agent && r.status !== "running")), newRun]);
      try {
        const client = tenantApi(user.id);
        const resp = await client.post<Record<string, unknown>>(
          endpoint,
          options?.body,
          { headers: { "X-Sama-Intent": "user-action" } },
        );
        // Backend may return run_id in several shapes — normalise here
        const runId =
          (typeof resp?.run_id === "string" && resp.run_id) ||
          (typeof resp?.id === "string" && resp.id) ||
          (resp?.run && typeof (resp.run as Record<string, unknown>).id === "string"
            ? ((resp.run as Record<string, unknown>).id as string)
            : undefined);
        updateRun(id, {
          status: "running",
          run_id: runId || undefined,
        });
        return id;
      } catch (e) {
        updateRun(id, {
          status: "failed",
          error: e instanceof Error ? e.message : "Could not trigger agent",
          completed_at: Date.now(),
        });
        return id;
      }
    },
    [user, updateRun],
  );

  const registerRun = useCallback<ActiveRunsContextValue["registerRun"]>(
    (agent, runId, options) => {
      if (!user) return undefined;
      // De-dupe: if we're already tracking this backend run, don't add again.
      const existing = runsRef.current.find((r) => r.run_id === runId && r.agent === agent);
      if (existing) return existing.id;
      const id = `${agent}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const defaults = AGENT_DEFAULTS[agent];
      const newRun: ActiveRun = {
        id,
        agent,
        label: options?.label || defaults.label,
        triggered_at: Date.now(),
        expected_seconds: defaults.expected_seconds,
        status: "running",
        run_id: runId,
      };
      setRuns((prev) => [...prev, newRun]);
      return id;
    },
    [user],
  );

  const dismissRun = useCallback((id: string) => {
    setRuns((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setRuns((prev) => prev.filter((r) => r.status === "running" || r.status === "pending"));
  }, []);

  // Poll backend agent_runs and reconcile with active runs. Same tick also
  // drops completed runs that have been visible long enough so the banner
  // doesn't accumulate yesterday's results.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const reconcile = (
      prev: ActiveRun[],
      backendRuns: AgentRunRow[] | null,
      siteAuditRuns: Map<string, SiteAuditRunRow>,
    ): ActiveRun[] => {
      const reconciled = prev.map((local): ActiveRun => {
        if (local.status === "completed" || local.status === "failed") return local;
        const elapsed = Date.now() - local.triggered_at;

        // Site audits have their own table + progress fields; reconcile
        // against the per-run rows we fetched separately so the widget can
        // show real "X av Y sidor" progress.
        if (local.agent === "site_audit") {
          if (!local.run_id) {
            // Trigger response didn't include an id; the audit row exists
            // server-side but we can't poll it. Fall through to time-out.
            if (elapsed > TRACKING_TIMEOUT_MS) {
              return {
                ...local,
                status: "completed",
                summary: "Sajtanalysen startade — uppdatera sidan för att se resultatet.",
                completed_at: Date.now(),
              };
            }
            return local;
          }
          const row = siteAuditRuns.get(local.run_id);
          if (!row) {
            if (elapsed > TRACKING_TIMEOUT_MS) {
              return {
                ...local,
                status: "completed",
                summary: "Sajtanalysen startade — uppdatera sidan för att se resultatet.",
                completed_at: Date.now(),
              };
            }
            return local;
          }
          const next: ActiveRun = {
            ...local,
            pages_total: row.pages_total ?? local.pages_total,
            pages_done: row.pages_done ?? local.pages_done,
          };
          if (row.status === "completed") {
            next.status = "completed";
            next.summary = row.pages_analyzed
              ? `${row.pages_analyzed} sidor analyserade`
              : "Sajtanalys klar";
            next.completed_at = row.completed_at ? Date.parse(row.completed_at) : Date.now();
          } else if (row.status === "failed") {
            next.status = "failed";
            next.error = row.error || "Sajtanalys misslyckades";
            next.completed_at = row.completed_at ? Date.parse(row.completed_at) : Date.now();
          } else {
            next.status = "running";
          }
          return next;
        }

        // If we can't reach the agent_runs endpoint at all, give up tracking
        // after the soft timeout — the agent itself may still be running on
        // backend, we just can't see it from here.
        if (!backendRuns) {
          if (elapsed > TRACKING_TIMEOUT_MS) {
            return {
              ...local,
              status: "completed",
              summary: "Triggered — backend run status not available. Refresh the page to check for new data.",
              completed_at: Date.now(),
            };
          }
          return local;
        }
        // Prefer matching by run_id when the trigger response gave us one —
        // it's authoritative. Fall back to fuzzy agent-name + recency match.
        const candidate = local.run_id
          ? backendRuns.find((br) => br.id === local.run_id) || null
          : backendRuns
              .filter((br) => matchesAgent(br.agent_name, local.agent))
              .filter((br) => Date.parse(br.started_at) >= local.triggered_at - 30_000)
              .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0] || null;
        if (!candidate) {
          if (elapsed > TRACKING_TIMEOUT_MS) {
            return {
              ...local,
              status: "completed",
              summary: "Triggered — could not match a backend run for this agent. Refresh Recent Checks to see new rows.",
              completed_at: Date.now(),
            };
          }
          return local;
        }
        const next: ActiveRun = { ...local, run_id: candidate.id };
        if (candidate.status === "completed") {
          next.status = "completed";
          next.summary = candidate.summary || undefined;
          next.completed_at = candidate.completed_at
            ? Date.parse(candidate.completed_at)
            : Date.now();
        } else if (candidate.status === "failed") {
          next.status = "failed";
          next.error = candidate.error || candidate.summary || "Agent failed";
          next.completed_at = candidate.completed_at
            ? Date.parse(candidate.completed_at)
            : Date.now();
        } else {
          next.status = "running";
        }
        return next;
      });
      // Drop completed runs that have been on screen long enough
      return reconciled.filter(
        (r) =>
          !(r.status === "completed" && r.completed_at && Date.now() - r.completed_at > COMPLETED_AUTO_DISMISS_MS),
      );
    };
    const tick = async () => {
      const active = runsRef.current.filter(
        (r) => r.status === "running" || r.status === "pending",
      );
      const hasExpiredCompleted = runsRef.current.some(
        (r) => r.status === "completed" && r.completed_at && Date.now() - r.completed_at > COMPLETED_AUTO_DISMISS_MS,
      );
      if (active.length === 0 && !hasExpiredCompleted) return;
      let backendRuns: AgentRunRow[] | null = null;
      const siteAuditRuns = new Map<string, SiteAuditRunRow>();
      const activeNonAudit = active.filter((r) => r.agent !== "site_audit");
      const activeAuditIds = active
        .filter((r) => r.agent === "site_audit" && r.run_id)
        .map((r) => r.run_id as string);

      if (activeNonAudit.length > 0) {
        try {
          const data = await tenantApi(user.id).get<{ runs?: AgentRunRow[] }>(
            `/api/tenant/agent-runs?limit=30`,
          );
          backendRuns = data.runs || [];
        } catch {
          backendRuns = null;
        }
      }
      if (activeAuditIds.length > 0) {
        // Fetch each in-flight site_audit row in parallel. The audits
        // endpoint is per-row (no list-by-ids variant), but realistically
        // there's only ever one running at a time per tenant.
        await Promise.all(
          activeAuditIds.map(async (id) => {
            try {
              const row = await tenantApi(user.id).get<SiteAuditRunRow>(
                `/api/site-audit/runs/${id}`,
              );
              if (row && row.id) siteAuditRuns.set(row.id, row);
            } catch {
              // transient; ignore
            }
          }),
        );
      }
      if (cancelled) return;
      setRuns((prev) => reconcile(prev, backendRuns, siteAuditRuns));
    };
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const value = useMemo<ActiveRunsContextValue>(
    () => ({ runs, triggerRun, registerRun, dismissRun, clearCompleted }),
    [runs, triggerRun, registerRun, dismissRun, clearCompleted],
  );

  return <ActiveRunsContext.Provider value={value}>{children}</ActiveRunsContext.Provider>;
}

export function useActiveRuns(): ActiveRunsContextValue {
  const ctx = useContext(ActiveRunsContext);
  if (!ctx) throw new Error("useActiveRuns must be used inside <ActiveRunsProvider>");
  return ctx;
}

/**
 * Estimate completion percentage for a run that is currently running.
 * Prefers a real pages_done/pages_total ratio (site_audit) when present;
 * otherwise falls back to elapsed-time vs. expected duration. Capped at
 * 95% so the bar never claims to be done before the agent actually
 * finishes.
 */
export function estimateProgress(run: ActiveRun): number {
  if (run.status === "completed") return 100;
  if (run.status === "failed") return 100;
  if (run.pages_total && run.pages_total > 0) {
    const done = run.pages_done ?? 0;
    const pct = (done / run.pages_total) * 100;
    return Math.min(95, Math.max(2, Math.round(pct)));
  }
  const elapsedSeconds = (Date.now() - run.triggered_at) / 1000;
  const pct = (elapsedSeconds / run.expected_seconds) * 100;
  return Math.min(95, Math.max(2, Math.round(pct)));
}
