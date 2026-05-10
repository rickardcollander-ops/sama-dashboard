/**
 * Server-side helper that runs a single site-audit against the sama-agent
 * backend, polls until completion, and persists the result to public_audits
 * so it can be rendered with the existing /audit/r/{id} flow (and our PDF
 * report page).
 *
 * Used by both /api/public-audit (the free landing page) and the Apollo
 * batch runner under /api/admin/campaigns. Pulled out so the two flows can
 * never drift in poll/timeout behaviour.
 */

import { savePublicAudit } from "@/lib/public-audit-store";
import type { SiteAuditRun } from "@/app/c/analysis/audit-types";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";
const PUBLIC_TENANT_ID = process.env.PUBLIC_AUDIT_TENANT_ID || "public";
const PUBLIC_MAX_PAGES = Number(process.env.PUBLIC_AUDIT_MAX_PAGES || "5");

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 110_000; // batch jobs can run a bit longer

export interface AuditOutcome {
  /** Public audit id (also the share-URL slug). */
  id: string;
  domain: string;
  fetched_at: string;
  audit: SiteAuditRun;
  suggested_queries: string[];
}

export interface AuditError {
  error: string;
}

/**
 * SiteAuditRun also has an optional `error` field, so a plain `"error" in x`
 * check can't discriminate the two. We use the presence of `status` (which
 * AuditError never has) instead.
 */
function isAuditError(x: unknown): x is AuditError {
  return typeof x === "object" && x !== null
    && "error" in x && typeof (x as { error: unknown }).error === "string"
    && !("status" in x);
}

function suggestQueries(audit: SiteAuditRun, host: string): string[] {
  const brand = host.replace(/^www\./, "").split(".")[0].replace(/-/g, " ");
  const home = audit.pages.find((p) => {
    try { return new URL(p.url).pathname === "/"; } catch { return false; }
  }) || audit.pages[0];
  const titleHint = (home?.title || "").split(/[|\-–—]/)[0].trim().toLowerCase();
  const topic = titleHint && titleHint.length > 4 && titleHint.length < 60 ? titleHint : brand;
  return [
    `Vilket är det bästa alternativet till ${brand}?`,
    `${brand} recensioner och omdömen 2026`,
    `${brand} vs konkurrenter – vad ska jag välja?`,
    `Bästa verktygen för ${topic}`,
    `Är ${brand} värt pengarna?`,
  ];
}

async function startBackendAudit(domain: string, maxPages: number): Promise<{ id: string } | AuditError> {
  if (!SAMA_API_URL) return { error: "NEXT_PUBLIC_SAMA_API_URL is not configured" };
  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-ID": PUBLIC_TENANT_ID,
      },
      body: JSON.stringify({ domain, max_pages: maxPages }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = (data as { detail?: string; error?: string }).detail
        || (data as { error?: string }).error;
      return { error: detail || `Backend HTTP ${upstream.status}` };
    }
    if (!data?.id) return { error: "Backend returned no audit id" };
    return { id: data.id as string };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return { error: `Could not start audit: ${msg}` };
  }
}

async function pollBackendAudit(runId: string): Promise<SiteAuditRun | AuditError> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    try {
      const res = await fetch(`${SAMA_API_URL}/api/site-audit/runs/${runId}`, {
        headers: { "X-Tenant-ID": PUBLIC_TENANT_ID },
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        const data = (await res.json()) as SiteAuditRun;
        if (data?.status && data.status !== "running") {
          if (data.status === "failed") return { error: data.error || "Audit failed" };
          return data;
        }
      }
    } catch {
      // transient — keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return { error: "Audit timed out" };
}

/**
 * Run a full audit for `domain` and persist it. Returns the public audit id
 * on success, or an AuditError. Caller decides how to surface the error
 * (HTTP response vs. row update on apollo_leads).
 */
export async function runAndSaveAudit(
  domain: string,
  opts: { maxPages?: number } = {},
): Promise<AuditOutcome | AuditError> {
  const maxPages = opts.maxPages ?? PUBLIC_MAX_PAGES;

  const started = await startBackendAudit(domain, maxPages);
  if ("error" in started) return started;

  const audit = await pollBackendAudit(started.id);
  if (isAuditError(audit)) return audit;

  const result = {
    domain,
    fetched_at: new Date().toISOString(),
    audit,
    suggested_queries: suggestQueries(audit, domain),
  };

  const id = await savePublicAudit(result).catch(() => null);
  if (!id) return { error: "Could not persist audit (Supabase service role missing?)" };

  return { id, ...result };
}
