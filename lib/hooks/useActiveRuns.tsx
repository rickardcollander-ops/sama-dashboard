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

export type AgentKey = "ai_visibility" | "seo" | "analytics" | "ads" | "content" | "social";

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

const AGENT_NAME_ALIASES: Record<AgentKey, string[]> = {
  ai_visibility: ["ai_visibility", "geo", "ai-visibility", "aivisibility"],
  seo: ["seo", "search_console", "gsc"],
  analytics: ["analytics", "ga4", "google_analytics"],
  ads: ["ads", "google_ads"],
  content: ["content"],
  social: ["social"],
};

export const AGENT_DEFAULTS: Record<AgentKey, { label: string; expected_seconds: number }> = {
  ai_visibility: { label: "AI Visibility (GEO)", expected_seconds: 300 },
  seo: { label: "SEO / Search Console", expected_seconds: 60 },
  analytics: { label: "Analytics", expected_seconds: 45 },
  ads: { label: "Google Ads", expected_seconds: 45 },
  content: { label: "Content generation", expected_seconds: 90 },
  social: { label: "Social", expected_seconds: 45 },
};

interface ActiveRunsContextValue {
  runs: ActiveRun[];
  triggerRun: (agent: AgentKey, endpoint: string, options?: { label?: string }) => Promise<void>;
  dismissRun: (id: string) => void;
  clearCompleted: () => void;
}

const ActiveRunsContext = createContext<ActiveRunsContextValue | null>(null);

const POLL_INTERVAL_MS = 12_000;
const COMPLETED_AUTO_DISMISS_MS = 60_000;
const HARD_TIMEOUT_MS = 25 * 60 * 1000;

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
      if (!user) return;
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
        const resp = await client.post<{ run_id?: string; status?: string }>(
          endpoint,
          undefined,
          { headers: { "X-Sama-Intent": "user-action" } },
        );
        updateRun(id, {
          status: "running",
          run_id: resp?.run_id,
        });
      } catch (e) {
        updateRun(id, {
          status: "failed",
          error: e instanceof Error ? e.message : "Could not trigger agent",
          completed_at: Date.now(),
        });
      }
    },
    [user, updateRun],
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
    const reconcile = (prev: ActiveRun[], backendRuns: AgentRunRow[] | null): ActiveRun[] => {
      const reconciled = prev.map((local) => {
        if (local.status === "completed" || local.status === "failed") return local;
        if (!backendRuns) {
          if (Date.now() - local.triggered_at > HARD_TIMEOUT_MS) {
            return {
              ...local,
              status: "failed" as const,
              error: "Agent did not start within the timeout window",
              completed_at: Date.now(),
            };
          }
          return local;
        }
        const aliases = AGENT_NAME_ALIASES[local.agent].map((a) => a.toLowerCase());
        const candidate = backendRuns
          .filter((br) => aliases.includes((br.agent_name || "").toLowerCase()))
          .filter((br) => Date.parse(br.started_at) >= local.triggered_at - 30_000)
          .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
        if (!candidate) {
          if (Date.now() - local.triggered_at > HARD_TIMEOUT_MS) {
            return {
              ...local,
              status: "failed" as const,
              error: "Agent did not start within the timeout window",
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
      if (active.length > 0) {
        try {
          const data = await tenantApi(user.id).get<{ runs?: AgentRunRow[] }>(
            `/api/tenant/agent-runs?limit=30`,
          );
          backendRuns = data.runs || [];
        } catch {
          backendRuns = null;
        }
      }
      if (cancelled) return;
      setRuns((prev) => reconcile(prev, backendRuns));
    };
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const value = useMemo<ActiveRunsContextValue>(
    () => ({ runs, triggerRun, dismissRun, clearCompleted }),
    [runs, triggerRun, dismissRun, clearCompleted],
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
 * Based on elapsed time vs. expected duration; capped at 95% so the bar
 * never claims to be done before the agent actually finishes.
 */
export function estimateProgress(run: ActiveRun): number {
  if (run.status === "completed") return 100;
  if (run.status === "failed") return 100;
  const elapsedSeconds = (Date.now() - run.triggered_at) / 1000;
  const pct = (elapsedSeconds / run.expected_seconds) * 100;
  return Math.min(95, Math.max(2, Math.round(pct)));
}
