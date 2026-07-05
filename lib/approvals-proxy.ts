/**
 * Shared auth + proxy plumbing for the /api/approvals/* routes.
 *
 * These routes used to forward a client-supplied X-Tenant-ID to the backend
 * with no session check at all — any anonymous caller could list, approve
 * (which triggers publishing) or reject another tenant's content. They now
 * require a Supabase session and resolve/validate the tenant server-side via
 * buildBackendAuth (ownership, account membership, or platform admin),
 * mirroring the /api/sama proxy contract.
 */
import { NextRequest, NextResponse } from "next/server";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";

const SAMA_API_URL =
  process.env.SAMA_API_URL ||
  process.env.NEXT_PUBLIC_SAMA_API_URL ||
  "";

export interface ApprovalsProxyOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: string;
  timeoutMs?: number;
  /** Returned as-is (with 200) when upstream fails and the route prefers a
   *  soft fallback over an error (list/stats polling). */
  fallback?: unknown;
}

export async function approvalsProxy(
  req: NextRequest,
  path: string,
  opts: ApprovalsProxyOptions = {},
): Promise<NextResponse> {
  if (!SAMA_API_URL) {
    return opts.fallback !== undefined
      ? NextResponse.json(opts.fallback)
      : NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }

  const auth = await buildBackendAuth(req, opts.body ? "application/json" : undefined);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const upstream = await fetch(`${SAMA_API_URL.replace(/\/$/, "")}${path}`, {
      method: opts.method || "GET",
      headers: auth.headers,
      body: opts.body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    if (!upstream.ok && opts.fallback !== undefined) {
      return NextResponse.json(opts.fallback);
    }
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.ok ? 200 : upstream.status });
  } catch {
    return opts.fallback !== undefined
      ? NextResponse.json(opts.fallback)
      : NextResponse.json({ error: "Upstream unavailable" }, { status: 502 });
  }
}
