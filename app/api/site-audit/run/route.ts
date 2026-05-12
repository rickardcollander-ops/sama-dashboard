import { NextRequest, NextResponse } from "next/server";
import { buildBackendAuth } from "@/lib/integrations/backend-auth";

const SAMA_API_URL = process.env.NEXT_PUBLIC_SAMA_API_URL || "";

/**
 * POST /api/site-audit/run
 *
 * Body: { domain?, max_pages? }
 *
 * Proxies to sama-agent's /api/site-audit/run, which inserts a row and runs
 * the crawl in the background. Returns {id, status: "running"} so the
 * frontend can poll /api/site-audit/runs/{id}.
 */
export async function POST(req: NextRequest) {
  if (!SAMA_API_URL) {
    return NextResponse.json({ error: "Backend not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const auth = await buildBackendAuth(req, "application/json");

  try {
    const upstream = await fetch(`${SAMA_API_URL}/api/site-audit/run`, {
      method: "POST",
      headers: auth.headers,
      body: JSON.stringify({
        domain: body.domain,
        max_pages: body.max_pages,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await upstream.json().catch(() => ({}));
    // FastAPI returns errors as {detail: "…"} — surface that as `error` so
    // the frontend can show the actual reason instead of a generic message.
    if (!upstream.ok) {
      const detail = (data as { detail?: string }).detail;
      return NextResponse.json(
        { error: detail || `Backend returned HTTP ${upstream.status}` },
        { status: upstream.status },
      );
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream unavailable";
    return NextResponse.json({ error: `Upstream unavailable: ${msg}` }, { status: 502 });
  }
}
